-- SEED-033: Agents + Workflows — autorização, resolução e execução
--
-- Connects the unified workflow engine (SEED-025) to the agent runtime so
-- agents can be authorized to call workflows as native tools, alongside the
-- legacy tool_configs path.
--
-- The agent_tools junction is extended with workflow_id. Each row references
-- EXACTLY ONE of tool_config_id or workflow_id (XOR), so the resolver knows
-- which source to read from. A unified view (agent_tools_resolved) collapses
-- both paths for read-only queries.

-- 1. Relax existing NOT NULL on tool_config_id so the column can be left
--    empty for workflow-attached rows. The XOR check below enforces that
--    exactly one source is set.
ALTER TABLE agent_tools ALTER COLUMN tool_config_id DROP NOT NULL;

-- 2. Add the workflow_id column.
ALTER TABLE agent_tools
  ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE;

-- 3. XOR constraint: a row has either a tool_config_id OR a workflow_id,
--    never both, never neither.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_tools_xor_source'
  ) THEN
    ALTER TABLE agent_tools
      ADD CONSTRAINT agent_tools_xor_source CHECK (
        (tool_config_id IS NOT NULL AND workflow_id IS NULL) OR
        (tool_config_id IS NULL AND workflow_id IS NOT NULL)
      );
  END IF;
END
$$;

-- 4. Uniqueness for workflow attachments: a given workflow may be attached
--    to a given agent at most once.
CREATE UNIQUE INDEX IF NOT EXISTS agent_tools_workflow_unique
  ON agent_tools(agent_id, workflow_id)
  WHERE workflow_id IS NOT NULL;

-- 5. Unified read-only view of attached tools. Callers that just want to
--    enumerate "what tools does this agent have" can SELECT from this view
--    without caring whether the source is a legacy tool_config or a workflow.
CREATE OR REPLACE VIEW agent_tools_resolved AS
SELECT
  at.id,
  at.organization_id,
  at.agent_id,
  at.allowed_channels,
  at.created_at,
  'tool_config'::text AS source,
  tc.tool_name,
  tc.action_type::text AS action_type,
  tc.config,
  tc.is_active,
  tc.id AS source_id,
  NULL::uuid AS workflow_id,
  NULL::text AS workflow_kind
FROM agent_tools at
JOIN tool_configs tc ON tc.id = at.tool_config_id
WHERE at.tool_config_id IS NOT NULL

UNION ALL

SELECT
  at.id,
  at.organization_id,
  at.agent_id,
  at.allowed_channels,
  at.created_at,
  'workflow'::text AS source,
  w.tool_name,
  w.kind::text AS action_type,
  COALESCE(wv.definition, '{}'::jsonb) AS config,
  (w.is_active AND NOT w.health_blocked) AS is_active,
  w.id AS source_id,
  w.id AS workflow_id,
  w.kind::text AS workflow_kind
FROM agent_tools at
JOIN workflows w ON w.id = at.workflow_id
LEFT JOIN workflow_versions wv ON wv.id = w.current_version_id
WHERE at.workflow_id IS NOT NULL;

-- 6. Backfill: any agent_tools row pointing at a tool_config that has since
--    been migrated to a workflow (via workflows.legacy_tool_config_id) gets
--    a dual workflow_id row created. Idempotent — NOT EXISTS guard prevents
--    duplicates on re-run.
INSERT INTO agent_tools (organization_id, agent_id, workflow_id, allowed_channels, created_at)
SELECT
  at.organization_id,
  at.agent_id,
  w.id AS workflow_id,
  at.allowed_channels,
  now()
FROM agent_tools at
JOIN workflows w ON w.legacy_tool_config_id = at.tool_config_id
WHERE at.tool_config_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM agent_tools at2
    WHERE at2.agent_id = at.agent_id
      AND at2.workflow_id = w.id
  );
