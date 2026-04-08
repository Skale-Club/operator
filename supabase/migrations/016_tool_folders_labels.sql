-- Migration 016: Add folder and labels to tool_configs
ALTER TABLE public.tool_configs
  ADD COLUMN IF NOT EXISTS folder  TEXT,
  ADD COLUMN IF NOT EXISTS labels  TEXT[] NOT NULL DEFAULT '{}';

-- Index for folder filtering per org
CREATE INDEX IF NOT EXISTS idx_tool_configs_folder
  ON public.tool_configs (organization_id, folder)
  WHERE folder IS NOT NULL;
