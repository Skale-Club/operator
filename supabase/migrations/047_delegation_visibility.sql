-- =============================================================================
-- Migration: 047_delegation_visibility
-- Phase: v2.0 Multi-Bot Platform — Phase 38 Multi-Agent Delegation
-- Adds: organizations.delegation_visibility (controls partner SSE event visibility)
-- Decisions: DELEG-08 — visibility on by default, per-org toggleable
-- =============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS delegation_visibility TEXT
    NOT NULL DEFAULT 'visible'
    CONSTRAINT chk_org_delegation_visibility
      CHECK (delegation_visibility IN ('visible', 'hidden'));

COMMENT ON COLUMN public.organizations.delegation_visibility IS
  'Phase 38 (v2.0 DELEG-08): Controls whether SSE stream emits partner_start/partner_done events.
   visible = emit events (default); hidden = suppress events for orgs that prefer a cleaner UI.';
