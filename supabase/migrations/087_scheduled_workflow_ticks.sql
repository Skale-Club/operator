-- =============================================================================
-- Migration 087: Scheduled Workflow Ticks Idempotency (SEED-027 Phase A)
-- =============================================================================
-- The minute-by-minute tick scheduler (SEED-027 Phase C) uses this table to
-- guarantee that a time-based event (meeting.starts_in, meeting.ended) fires
-- at most once per booking per workflow per target minute.
--
-- Composite primary key prevents double-fire even under overlapping cron
-- invocations or retry storms.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_workflow_ticks (
  workflow_id  uuid        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  booking_id   uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type   text        NOT NULL,
  fired_minute timestamptz NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workflow_id, booking_id, event_type, fired_minute)
);

CREATE INDEX idx_scheduled_workflow_ticks_dispatched
  ON public.scheduled_workflow_ticks (dispatched_at);

-- Auto-prune ancient ticks (anything > 30 days). Cheap because they're at
-- the tail of the dispatched_at index.
