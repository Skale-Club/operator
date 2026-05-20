-- =============================================================================
-- Migration 088: Tenant Locations (SEED-028 Phase A)
-- =============================================================================
-- Physical locations (stores, offices, clinics) managed by a tenant.
-- Referenced by event_types.default_store_location_id and by bookings
-- with location_kind='store_location' (migration 090).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_locations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  address_line_1  text        NOT NULL,
  address_line_2  text,
  city            text        NOT NULL,
  state           text,
  postal_code     text,
  country         text        NOT NULL DEFAULT 'US',
  latitude        double precision,
  longitude       double precision,
  phone           text,
  business_hours  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  notes           text,
  is_default      boolean     NOT NULL DEFAULT false,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_tenant_locations" ON public.tenant_locations
  USING (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

CREATE INDEX idx_tenant_locations_org
  ON public.tenant_locations (org_id, is_active);

-- One default per org enforced at the application layer (so flipping the
-- default is a normal mutation rather than a constraint violation).

CREATE TRIGGER trg_tenant_locations_updated_at
  BEFORE UPDATE ON public.tenant_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
