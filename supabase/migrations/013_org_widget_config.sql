-- =============================================================================
-- Migration 013: Add per-org widget configuration fields
-- Phase: 05-admin-configuration (v1.2)
-- Stores public-safe widget appearance settings directly on organizations.
-- =============================================================================

ALTER TABLE public.organizations
  ADD COLUMN widget_display_name TEXT,
  ADD COLUMN widget_primary_color TEXT,
  ADD COLUMN widget_welcome_message TEXT;
