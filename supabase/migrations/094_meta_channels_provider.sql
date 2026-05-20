-- Migration 094: Meta Channels Provider abstraction (SEED-032)
-- Adds a `provider` column to `meta_channels` to allow switching between the
-- official Meta Graph API ("direct") and ManyChat ("manychat") as the active
-- transport for a given (org, channel_type) pair. Also enforces that only one
-- active row exists per (org_id, channel_type) so providers can't double-fire.
--
-- NOTE: If your org currently has multiple is_active rows for the same
-- channel_type, the unique index creation will fail. Resolve by manually
-- deactivating duplicates before running this migration.

BEGIN;

-- ---------------------------------------------------------------------------
-- provider column with safe default
-- ---------------------------------------------------------------------------

ALTER TABLE public.meta_channels
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'direct';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meta_channels_provider_check'
  ) THEN
    ALTER TABLE public.meta_channels
      ADD CONSTRAINT meta_channels_provider_check
      CHECK (provider IN ('direct', 'manychat'));
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- One active provider per (org, channel_type)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS meta_channels_org_channel_active_idx
  ON public.meta_channels (org_id, channel_type)
  WHERE is_active = true;

COMMIT;
