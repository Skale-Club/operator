-- =============================================================================
-- Migration 099: Pipeline Workflow Automation (SEED-036)
-- =============================================================================
-- Wires the sales pipeline into the unified workflow engine.
--
-- 1) scheduled_opportunity_ticks — idempotency table for time-based
--    pipeline triggers (aged_in_stage, no_activity, close_date_*). The
--    v1 of SEED-036 only ships immediate event emission; the time-based
--    scheduler that consumes this table lands in a follow-up. The table
--    is created now so migrations don't have to be reshuffled later.
--
-- 2) action_type enum extension — adds the seven pipeline_* action values
--    that the workflow runtime dispatches to executors in
--    src/lib/action-engine/executors/pipeline-actions.ts.
-- =============================================================================

-- ─── scheduled_opportunity_ticks ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_opportunity_ticks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id     uuid        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  opportunity_id  uuid        NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,
  fire_at         timestamptz NOT NULL,
  fired           boolean     NOT NULL DEFAULT false,
  fired_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_opportunity_ticks_pending
  ON public.scheduled_opportunity_ticks (fire_at)
  WHERE fired = false;

CREATE INDEX IF NOT EXISTS idx_scheduled_opportunity_ticks_opp
  ON public.scheduled_opportunity_ticks (opportunity_id)
  WHERE fired = false;

ALTER TABLE public.scheduled_opportunity_ticks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_scheduled_opportunity_ticks" ON public.scheduled_opportunity_ticks
  FOR SELECT
  USING (org_id = (SELECT public.get_current_org_id()));

-- ─── action_type enum: add pipeline_* values ─────────────────────────────────
-- Mirrors the pattern from 098_action_type_telegram.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pipeline_move_opportunity'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_type')
  ) THEN
    ALTER TYPE action_type ADD VALUE 'pipeline_move_opportunity';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pipeline_update_opportunity'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_type')
  ) THEN
    ALTER TYPE action_type ADD VALUE 'pipeline_update_opportunity';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pipeline_mark_won'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_type')
  ) THEN
    ALTER TYPE action_type ADD VALUE 'pipeline_mark_won';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pipeline_mark_lost'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_type')
  ) THEN
    ALTER TYPE action_type ADD VALUE 'pipeline_mark_lost';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pipeline_add_note'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_type')
  ) THEN
    ALTER TYPE action_type ADD VALUE 'pipeline_add_note';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pipeline_assign_user'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_type')
  ) THEN
    ALTER TYPE action_type ADD VALUE 'pipeline_assign_user';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pipeline_create_opportunity'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_type')
  ) THEN
    ALTER TYPE action_type ADD VALUE 'pipeline_create_opportunity';
  END IF;
END$$;
