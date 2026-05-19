-- 075_workflow_engine.sql
-- Visual Automation Builder — Phase B: Engine + Triggers
-- workflow_triggers (declarative), workflow_runs (one per execution),
-- workflow_run_steps (per-step trace), workflow_waits (for step.waitForEvent — schema reserved).

-- ─── workflow_triggers ────────────────────────────────────────────────────────

CREATE TABLE public.workflow_triggers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id    uuid        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  event_type     text        NOT NULL,
  filter         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  schedule_cron  text,
  enabled        boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_workflow_triggers" ON public.workflow_triggers
  USING  (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

CREATE INDEX ON public.workflow_triggers (event_type, enabled);
CREATE INDEX ON public.workflow_triggers (workflow_id);

CREATE TRIGGER trg_workflow_triggers_updated_at
  BEFORE UPDATE ON public.workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── workflow_runs ────────────────────────────────────────────────────────────

CREATE TABLE public.workflow_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id         uuid        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  workflow_version_id uuid        REFERENCES public.workflow_versions(id) ON DELETE SET NULL,
  trigger_type        text        NOT NULL DEFAULT 'manual',
  trigger_payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status              text        NOT NULL DEFAULT 'queued'
                                  CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  state               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  started_at          timestamptz,
  ended_at            timestamptz,
  error               text,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_workflow_runs" ON public.workflow_runs
  USING  (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

CREATE INDEX ON public.workflow_runs (workflow_id, created_at DESC);
CREATE INDEX ON public.workflow_runs (org_id, status, created_at DESC);

-- ─── workflow_run_steps ──────────────────────────────────────────────────────

CREATE TABLE public.workflow_run_steps (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     uuid        NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_id    text        NOT NULL,
  node_id    text        NOT NULL,
  node_type  text        NOT NULL,
  status     text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','running','succeeded','failed','skipped')),
  input      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  output     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error      text,
  started_at timestamptz,
  ended_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_workflow_run_steps" ON public.workflow_run_steps
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_runs r
      WHERE r.id = workflow_run_steps.run_id
        AND r.org_id = (SELECT public.get_current_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflow_runs r
      WHERE r.id = workflow_run_steps.run_id
        AND r.org_id = (SELECT public.get_current_org_id())
    )
  );

CREATE INDEX ON public.workflow_run_steps (run_id, created_at);

-- ─── workflow_waits (reserved for future step.waitForEvent) ──────────────────
-- Schema is in place so the engine can grow into long-running flows without
-- another migration. Engine in this milestone does not yet write to it.

CREATE TABLE public.workflow_waits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid        NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  event_filter  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  timeout_at    timestamptz,
  satisfied_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_waits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_workflow_waits" ON public.workflow_waits
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_runs r
      WHERE r.id = workflow_waits.run_id
        AND r.org_id = (SELECT public.get_current_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflow_runs r
      WHERE r.id = workflow_waits.run_id
        AND r.org_id = (SELECT public.get_current_org_id())
    )
  );

CREATE INDEX ON public.workflow_waits (timeout_at) WHERE satisfied_at IS NULL;
