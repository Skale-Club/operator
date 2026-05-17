-- Migration 058: Twilio multi-number support (v2.3)
--
-- Promotes "from_number" from a single JSONB string in `integrations.config`
-- to a first-class per-org entity. Each org can register multiple Twilio
-- numbers with capabilities (SMS / MMS / Voice), a friendly label, a default
-- routing mode, and a default flag for outbound routing.
--
-- Backfills every active Twilio integration that has a non-empty
-- `config.from_number` as a single default number for that org so existing
-- flows continue working without any application-level change in this phase.
--
-- The legacy `integrations.config.from_number` field is intentionally NOT
-- removed in this migration. Phase 59 keeps it as a read-fallback path so
-- this release can ship without forcing a full cutover. Removal is deferred
-- to the next milestone.

BEGIN;

-- ---------------------------------------------------------------------------
-- twilio_phone_numbers: one row per (org, e164)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.twilio_phone_numbers (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  e164                  TEXT         NOT NULL,
  phone_sid             TEXT,
  friendly_name         TEXT         NOT NULL,
  capability_sms        BOOLEAN      NOT NULL DEFAULT false,
  capability_mms        BOOLEAN      NOT NULL DEFAULT false,
  capability_voice      BOOLEAN      NOT NULL DEFAULT false,
  default_routing_mode  TEXT         CHECK (default_routing_mode IS NULL OR default_routing_mode IN ('browser', 'sip', 'forward')),
  forward_to_number     TEXT,
  is_default            BOOLEAN      NOT NULL DEFAULT false,
  is_active             BOOLEAN      NOT NULL DEFAULT true,
  notes                 TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (organization_id, e164)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_twilio_phone_numbers_org
  ON public.twilio_phone_numbers (organization_id);

-- Supports resolveTwilioOrgByToNumber(toNumber) lookups (Phase 59).
CREATE INDEX IF NOT EXISTS idx_twilio_phone_numbers_e164_active
  ON public.twilio_phone_numbers (e164)
  WHERE is_active = true;

-- Exactly zero or one default per org — DB-enforced, race-safe.
CREATE UNIQUE INDEX IF NOT EXISTS twilio_phone_numbers_one_default_per_org
  ON public.twilio_phone_numbers (organization_id)
  WHERE is_default = true;

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses shared function from migration 001)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_twilio_phone_numbers_updated_at ON public.twilio_phone_numbers;
CREATE TRIGGER trg_twilio_phone_numbers_updated_at
  BEFORE UPDATE ON public.twilio_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: org isolation via get_current_org_id()
-- ---------------------------------------------------------------------------

ALTER TABLE public.twilio_phone_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS twilio_phone_numbers_org_isolation ON public.twilio_phone_numbers;
CREATE POLICY twilio_phone_numbers_org_isolation
  ON public.twilio_phone_numbers
  FOR ALL
  TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- ---------------------------------------------------------------------------
-- Backfill from integrations.config.from_number
-- ---------------------------------------------------------------------------
-- One row per active Twilio integration with a non-empty from_number.
-- Uses ON CONFLICT to make the migration safely re-runnable.
-- Backfill defaults: SMS + Voice = true, MMS = false. Matches the de-facto
-- capability of the current single-number setup; operators can refine in the
-- Phase 60 UI.

INSERT INTO public.twilio_phone_numbers (
  organization_id,
  e164,
  friendly_name,
  capability_sms,
  capability_voice,
  capability_mms,
  is_default,
  is_active
)
SELECT
  organization_id,
  config->>'from_number'                AS e164,
  COALESCE(config->>'from_number', '')  AS friendly_name,
  true                                  AS capability_sms,
  true                                  AS capability_voice,
  false                                 AS capability_mms,
  true                                  AS is_default,
  true                                  AS is_active
FROM public.integrations
WHERE provider = 'twilio'
  AND is_active = true
  AND config ? 'from_number'
  AND config->>'from_number' IS NOT NULL
  AND config->>'from_number' <> ''
ON CONFLICT (organization_id, e164) DO NOTHING;

COMMIT;
