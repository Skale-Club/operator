-- =============================================================================
-- Migration: 026_manychat_foundation
-- Phase: v1.6 ManyChat Integration — Phase 22 Foundation
-- Creates: manychat_channels (one per org, encrypted API key + webhook secret)
--          manychat_events (append-only inbound webhook log)
-- Extends: integration_provider enum with 'manychat'
-- Note: manychat_events.matched_rule_id and action_log_id FKs added in Phase 23 migration
-- Note: config JSONB on manychat_channels reserved for future payload field mappings
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend integration_provider enum
--    NOTE: PostgreSQL enum ADD VALUE cannot run inside a BEGIN/COMMIT block.
--    Supabase migrations execute each file with implicit DDL handling that
--    accepts ADD VALUE IF NOT EXISTS — same pattern as 006_api_key_admin.sql.
-- -----------------------------------------------------------------------------
ALTER TYPE public.integration_provider ADD VALUE IF NOT EXISTS 'manychat';

-- -----------------------------------------------------------------------------
-- 2. manychat_channels table
--    One row per org (UNIQUE(org_id)). Stores encrypted ManyChat API key plus
--    a per-channel shared secret used by the webhook handler to authenticate
--    inbound External Request events.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manychat_channels (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_name      TEXT         NOT NULL,
  encrypted_api_key TEXT         NOT NULL,
  key_hint          TEXT,
  webhook_secret    TEXT         NOT NULL,
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  config            JSONB        NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT manychat_channels_org_id_unique UNIQUE (org_id)
);

ALTER TABLE public.manychat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.manychat_channels
  FOR ALL
  TO authenticated
  USING  (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

CREATE TRIGGER trg_manychat_channels_updated_at
  BEFORE UPDATE ON public.manychat_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- 3. manychat_events table (append-only)
--    Full audit trail of inbound webhook events. The webhook handler runs
--    with the service role and bypasses RLS for inserts. Authenticated dashboard
--    users get SELECT + INSERT; UPDATE and DELETE are intentionally absent.
--    matched_rule_id and action_log_id are nullable now; FK constraints are
--    added in the Phase 23 migration once those tables exist.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manychat_events (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id      UUID         NOT NULL REFERENCES public.manychat_channels(id) ON DELETE CASCADE,
  event_type      TEXT         NOT NULL,
  event_payload   JSONB        NOT NULL DEFAULT '{}',
  matched_rule_id UUID,  -- FK to manychat_rules added in Phase 23 migration
  status          TEXT         NOT NULL CHECK (status IN ('matched', 'unmatched', 'error')),
  action_log_id   UUID,  -- FK to action_logs added in Phase 23 migration
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.manychat_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.manychat_events
  FOR SELECT
  TO authenticated
  USING (org_id = (SELECT public.get_current_org_id()));

CREATE POLICY "org_isolation_insert" ON public.manychat_events
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));
-- No UPDATE or DELETE policies — manychat_events is append-only (full audit trail)
