-- SEED-038: Workflow folders, archive, and trash.
--
-- Adds a first-class folder system for workflows, plus soft archive
-- (`archived_at`) and soft delete (`deleted_at`) semantics so users can
-- organize, hide, or trash workflows without losing them.
--
-- Note: this is migration 100. The spec mentioned 099, but 099 was claimed by
-- SEED-036 (pipeline workflow automation) before this seed landed.

CREATE TABLE workflow_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,                       -- optional hex, e.g. '#6366F1'
  icon        TEXT,                       -- optional lucide icon name
  parent_id   UUID REFERENCES workflow_folders(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, parent_id, name)
);

ALTER TABLE workflow_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_folders org members"
  ON workflow_folders
  USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());

CREATE INDEX workflow_folders_org_parent_idx
  ON workflow_folders(org_id, parent_id);

-- Extend workflows with folder linkage + lifecycle columns.
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS folder_id   UUID REFERENCES workflow_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS workflows_folder_idx
  ON workflows(folder_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS workflows_archived_idx
  ON workflows(org_id, archived_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS workflows_deleted_idx
  ON workflows(org_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Keep updated_at fresh on folder rows.
CREATE OR REPLACE FUNCTION touch_workflow_folder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workflow_folders_touch ON workflow_folders;
CREATE TRIGGER trg_workflow_folders_touch
  BEFORE UPDATE ON workflow_folders
  FOR EACH ROW
  EXECUTE FUNCTION touch_workflow_folder_updated_at();
