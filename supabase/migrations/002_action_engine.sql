-- =============================================================================
-- Migration 002: Action Engine Schema
-- Phase: 02-action-engine
-- Requirements: ACTN-03, ACTN-06, ACTN-07, ACTN-08, ACTN-10
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Section 1: Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.action_type AS ENUM (
  'create_contact',
  'get_availability',
  'create_appointment',
  'send_sms',
  'knowledge_base',
  'custom_webhook'
);

CREATE TYPE public.integration_provider AS ENUM (
  'gohighlevel',
  'twilio',
  'calcom',
  'custom_webhook'
);

-- ---------------------------------------------------------------------------
-- Section 2: integrations table
-- ---------------------------------------------------------------------------
-- Stores per-org credentials for external platforms.
-- encrypted_api_key: AES-256-GCM ciphertext (format: iv:ciphertext) — NEVER plaintext.
-- The webhook hot path decrypts using ENCRYPTION_SECRET env var in the Edge Function.

CREATE TABLE public.integrations (
  id                UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID                       NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider          public.integration_provider NOT NULL,
  name              TEXT                       NOT NULL,
  encrypted_api_key TEXT                       NOT NULL,
  location_id       TEXT,
  config            JSONB                      NOT NULL DEFAULT '{}',
  is_active         BOOLEAN                    NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ                NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ                NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_integrations_org_id ON public.integrations(organization_id);

CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Section 3: tool_configs table
-- ---------------------------------------------------------------------------
-- Maps a Vapi tool name to an action type and integration for a given org.
-- UNIQUE(organization_id, tool_name): one config per tool name per org.
-- integration_id ON DELETE RESTRICT: prevents deleting an integration that has
--   active tool configs — admin must reconfigure tool first.

CREATE TABLE public.tool_configs (
  id                UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID               NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id    UUID               NOT NULL REFERENCES public.integrations(id) ON DELETE RESTRICT,
  tool_name         TEXT               NOT NULL,
  action_type       public.action_type NOT NULL,
  config            JSONB              NOT NULL DEFAULT '{}',
  fallback_message  TEXT               NOT NULL,
  is_active         BOOLEAN            NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ        NOT NULL DEFAULT now(),
  UNIQUE(organization_id, tool_name)
);

ALTER TABLE public.tool_configs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tool_configs_org_id   ON public.tool_configs(organization_id);

-- CRITICAL: Load-bearing composite index for the webhook hot path.
-- Every incoming Vapi tool call executes: WHERE organization_id = $1 AND tool_name = $2
CREATE INDEX idx_tool_configs_org_tool ON public.tool_configs(organization_id, tool_name);

CREATE TRIGGER trg_tool_configs_updated_at
  BEFORE UPDATE ON public.tool_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Section 4: action_logs table
-- ---------------------------------------------------------------------------
-- Append-only audit log of every tool execution.
-- tool_config_id ON DELETE SET NULL: preserves log history even if tool config is deleted.
-- No updated_at column — rows are never updated after insertion.
-- status TEXT CHECK: avoids a third enum type for a simple 3-value set.

CREATE TABLE public.action_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tool_config_id    UUID        REFERENCES public.tool_configs(id) ON DELETE SET NULL,
  vapi_call_id      TEXT        NOT NULL,
  tool_name         TEXT        NOT NULL,
  status            TEXT        NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  execution_ms      INTEGER     NOT NULL,
  request_payload   JSONB       NOT NULL DEFAULT '{}',
  response_payload  JSONB       NOT NULL DEFAULT '{}',
  error_detail      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_action_logs_org_id      ON public.action_logs(organization_id);
CREATE INDEX idx_action_logs_created     ON public.action_logs(created_at DESC);
CREATE INDEX idx_action_logs_tool_config ON public.action_logs(tool_config_id);

-- ---------------------------------------------------------------------------
-- Section 5: RLS policies for integrations
-- ---------------------------------------------------------------------------
-- All policies use (SELECT public.get_current_org_id()) subquery wrapper
-- so the function is evaluated once per statement, not once per row.

CREATE POLICY "integrations_select" ON public.integrations
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "integrations_insert" ON public.integrations
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "integrations_update" ON public.integrations
  FOR UPDATE TO authenticated
  USING     (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "integrations_delete" ON public.integrations
  FOR DELETE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

-- ---------------------------------------------------------------------------
-- Section 6: RLS policies for tool_configs
-- ---------------------------------------------------------------------------

CREATE POLICY "tool_configs_select" ON public.tool_configs
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "tool_configs_insert" ON public.tool_configs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "tool_configs_update" ON public.tool_configs
  FOR UPDATE TO authenticated
  USING     (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "tool_configs_delete" ON public.tool_configs
  FOR DELETE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

-- ---------------------------------------------------------------------------
-- Section 7: RLS policies for action_logs
-- ---------------------------------------------------------------------------
-- action_logs is append-only: SELECT and INSERT only — no UPDATE or DELETE.
-- The webhook route writes logs via service-role key (bypasses RLS by design).
-- RLS policies only apply to admin UI server actions reading log history.

CREATE POLICY "action_logs_select" ON public.action_logs
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY "action_logs_insert" ON public.action_logs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));
