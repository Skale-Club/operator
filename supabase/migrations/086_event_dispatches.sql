-- =============================================================================
-- Migration 086: Event Dispatches Audit Trail (SEED-027 Phase A)
-- =============================================================================
-- Append-only log of every workflow event dispatched by lib/scheduling/transition.
-- Captures the trigger event, source row (booking_id), the workflows it was
-- enqueued for, and any cascade context (depth, parent dispatch).
--
-- Used for:
--   - Debugging "why didn't this reminder fire" issues
--   - Cycle prevention (depth > 3 triggers a circuit breaker)
--   - Idempotency check at the tick scheduler (SEED-027 Phase C)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.event_dispatches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,
  source_table    text        NOT NULL,
  source_id       uuid        NOT NULL,
  workflow_ids    uuid[]      NOT NULL DEFAULT '{}',
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  parent_id       uuid        REFERENCES public.event_dispatches(id) ON DELETE SET NULL,
  depth           integer     NOT NULL DEFAULT 0,
  dispatched_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_event_dispatches" ON public.event_dispatches
  FOR SELECT
  USING (org_id = (SELECT public.get_current_org_id()));

CREATE INDEX idx_event_dispatches_org_event
  ON public.event_dispatches (org_id, event_type, dispatched_at DESC);

CREATE INDEX idx_event_dispatches_source
  ON public.event_dispatches (source_table, source_id, dispatched_at DESC);
