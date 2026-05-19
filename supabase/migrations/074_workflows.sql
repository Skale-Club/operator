-- 074_workflows.sql
-- Visual Automation Builder — Phase A: Canvas Foundation
-- Workflows (header) + workflow_versions (immutable graph snapshots).
-- Engine, triggers, runs, waits will land in Phase B as migration 075.

-- ─── workflows: header row ────────────────────────────────────────────────────

CREATE TABLE public.workflows (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  slug          text        NOT NULL,
  description   text,
  is_active     boolean     NOT NULL DEFAULT false,
  current_version_id uuid,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_workflows" ON public.workflows
  USING  (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

CREATE INDEX ON public.workflows (org_id, is_active);
CREATE INDEX ON public.workflows (org_id, updated_at DESC);

CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── workflow_versions: immutable snapshots ──────────────────────────────────
-- A version's definition is the canonical Zod-validated graph JSON:
--   { nodes: [...], edges: [...], variables: [...], metadata: {...} }

CREATE TABLE public.workflow_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id    uuid        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version_number integer     NOT NULL,
  definition     jsonb       NOT NULL DEFAULT '{"nodes":[],"edges":[],"variables":[],"metadata":{}}'::jsonb,
  notes          text,
  created_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, version_number)
);

ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_workflow_versions" ON public.workflow_versions
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      WHERE w.id = workflow_versions.workflow_id
        AND w.org_id = (SELECT public.get_current_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflows w
      WHERE w.id = workflow_versions.workflow_id
        AND w.org_id = (SELECT public.get_current_org_id())
    )
  );

CREATE INDEX ON public.workflow_versions (workflow_id, version_number DESC);

-- Foreign key from workflows.current_version_id → workflow_versions.id (deferred until both exist)
ALTER TABLE public.workflows
  ADD CONSTRAINT workflows_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES public.workflow_versions(id) ON DELETE SET NULL;
