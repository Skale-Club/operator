-- =============================================================================
-- Migration: 031_tool_configs_integration_nullable
-- Phase: v1.8 Executor Completeness — Phase 31 Tool Config Form UI
-- Change: Makes tool_configs.integration_id nullable so custom_webhook
--         tool configs can be created without linking an integration.
-- Note: The FK constraint to integrations(id) is preserved — a non-null
--       value still must reference a valid integration row.
-- =============================================================================

ALTER TABLE public.tool_configs ALTER COLUMN integration_id DROP NOT NULL;
