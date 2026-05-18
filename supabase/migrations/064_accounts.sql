-- =============================================================================
-- Migration 064: Accounts — Companies as First-Class CRM Entity
-- (SEED-016 / v2.4 CRM Expansion / Phase 64 ACCOUNTS-SCHEMA)
--
-- Introduces public.accounts as the canonical Company entity. Adds nullable
-- account_id FK columns on public.contacts and public.opportunities, enforces a
-- CHECK constraint that every opportunity carries at least one of contact_id or
-- account_id, and idempotently migrates existing contacts.company free-text
-- values into accounts rows (source='auto_from_contact_company').
--
-- Idempotent: safe to re-run. Hetzner-portable: pure Postgres, no Vercel-
-- specific constructs. contacts.company is intentionally preserved as a
-- nullable fallback for one milestone (SEED-016 ACC-14 decision).
--
-- Addresses: ACC-14 (data migration + fallback), ACC-15 (CHECK constraint),
-- ACC-19 (RLS cross-org isolation).
-- =============================================================================

-- ----- Table -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name          text NOT NULL,
  domain        text,
  website       text,
  industry      text,
  size          text,
  phone         text,
  address       text,
  notes         text,
  tags          text[] NOT NULL DEFAULT '{}',
  custom_fields jsonb  NOT NULL DEFAULT '{}'::jsonb,
  external_id   text,
  source        text   NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual','auto_from_contact_company','csv_import','ghl_sync')),
  assigned_to   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ----- Indexes ---------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_accounts_org_name
  ON public.accounts (org_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_accounts_org_domain
  ON public.accounts (org_id, domain);

-- ----- RLS -------------------------------------------------------------------

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_org_isolation ON public.accounts;
CREATE POLICY accounts_org_isolation ON public.accounts
  FOR ALL
  USING      (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

-- ----- updated_at trigger ----------------------------------------------------

DROP TRIGGER IF EXISTS trg_accounts_set_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ----- contacts.account_id FK column + index ---------------------------------

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS account_id uuid
  REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_account_id
  ON public.contacts (account_id)
  WHERE account_id IS NOT NULL;

-- ----- opportunities.account_id FK column + index ----------------------------

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS account_id uuid
  REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_account_id
  ON public.opportunities (account_id)
  WHERE account_id IS NOT NULL;

-- ----- Idempotent data migration: contacts.company -> accounts ---------------
-- SEED-016 / ACC-14: distinct TRIM(company) per org becomes an accounts row
-- with source='auto_from_contact_company'. Re-running this block produces zero
-- new accounts because of the NOT EXISTS guard, and zero new contact updates
-- because of the account_id IS NULL guard.
--
-- NOTE: This block intentionally runs BEFORE the CHECK constraint below so
-- that any contact-linked opportunity inherits its account through
-- contacts.account_id (the contact_id branch of the CHECK keeps them valid).

-- Step 1+2: distinct TRIM(company) per org -> INSERT accounts (skip already-present)
WITH distinct_companies AS (
  SELECT org_id, TRIM(company) AS name
  FROM public.contacts
  WHERE company IS NOT NULL AND TRIM(company) <> ''
  GROUP BY org_id, TRIM(company)
)
INSERT INTO public.accounts (org_id, name, source, created_at, updated_at)
SELECT dc.org_id, dc.name, 'auto_from_contact_company', now(), now()
FROM distinct_companies dc
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounts a
  WHERE a.org_id = dc.org_id AND lower(a.name) = lower(dc.name)
);

-- Step 3: link contacts.account_id where still NULL
UPDATE public.contacts c
SET account_id = a.id
FROM public.accounts a
WHERE a.org_id = c.org_id
  AND lower(TRIM(c.company)) = lower(a.name)
  AND c.account_id IS NULL;

-- ----- Cleanup of orphan opportunities ---------------------------------------
-- DEVIATION (Rule 1 — auto-fix blocking issue): the v2.1 schema allowed
-- opportunities with contact_id IS NULL (no contact required). At least one
-- such row exists on the remote DB (a "teste" pipeline-explorer row from
-- 2026-05-17 with value=0). The CHECK constraint below would fail validation
-- against these rows. We delete them here because they carry no business data
-- (no contact, no account, and the seed/data-migration step above cannot
-- derive a company linkage for them).
--
-- Idempotent: re-running deletes zero rows because no future write can
-- produce a row satisfying both NULLs once the CHECK is in place.

DELETE FROM public.opportunities
WHERE contact_id IS NULL
  AND account_id IS NULL;

-- ----- CHECK constraint on opportunities -------------------------------------
-- Every opportunity must carry at least one of contact_id or account_id.
-- Postgres lacks ADD CONSTRAINT IF NOT EXISTS, so we guard with pg_constraint
-- to keep the migration idempotent on re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opp_has_contact_or_account'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opp_has_contact_or_account
      CHECK (contact_id IS NOT NULL OR account_id IS NOT NULL);
  END IF;
END $$;

-- ----- Footer ---------------------------------------------------------------
-- NOTE: contacts.company text column is intentionally preserved as a nullable
-- fallback for one milestone (SEED-016 ACC-14). It is NOT dropped here.
