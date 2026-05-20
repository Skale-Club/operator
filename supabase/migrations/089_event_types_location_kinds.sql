-- =============================================================================
-- Migration 089: Event Types — Allowed Location Kinds (SEED-028 Phase A)
-- =============================================================================
-- Each event_type declares which location kinds bookers can choose from.
-- Single-kind event types skip the booker picker; multi-kind event types
-- prompt the booker at checkout.
-- =============================================================================

ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS allowed_location_kinds text[] NOT NULL DEFAULT ARRAY['video']::text[],
  ADD COLUMN IF NOT EXISTS default_store_location_id uuid REFERENCES public.tenant_locations(id) ON DELETE SET NULL;

-- Validate that every entry in allowed_location_kinds is from the known set.
-- Enforced via a check constraint on a tiny lookup table for forward
-- compatibility (adding a new kind = INSERT, not a constraint change).

CREATE TABLE IF NOT EXISTS public._location_kinds (
  kind text PRIMARY KEY
);

INSERT INTO public._location_kinds (kind) VALUES
  ('google_meet'),
  ('zoom'),
  ('whereby'),
  ('store_location'),
  ('client_address'),
  ('custom_address'),
  ('phone_call'),
  ('custom_phone'),
  ('custom_link'),
  ('video'),               -- legacy alias retained for backwards-compat reads
  ('phone'),
  ('in_person')
ON CONFLICT (kind) DO NOTHING;

-- Validation function executed by a trigger on event_types insert/update.
CREATE OR REPLACE FUNCTION public.validate_event_type_location_kinds()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bad_kind text;
BEGIN
  SELECT k INTO bad_kind
  FROM unnest(NEW.allowed_location_kinds) AS k
  WHERE NOT EXISTS (SELECT 1 FROM public._location_kinds WHERE kind = k)
  LIMIT 1;

  IF bad_kind IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown location kind: %', bad_kind;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_types_validate_location_kinds ON public.event_types;
CREATE TRIGGER trg_event_types_validate_location_kinds
  BEFORE INSERT OR UPDATE OF allowed_location_kinds ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_type_location_kinds();

CREATE INDEX IF NOT EXISTS idx_event_types_default_store_location
  ON public.event_types (default_store_location_id)
  WHERE default_store_location_id IS NOT NULL;
