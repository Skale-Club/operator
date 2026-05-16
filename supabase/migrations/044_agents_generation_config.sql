-- =============================================================================
-- Migration: 044_agents_generation_config
-- Phase: v2.0 Multi-Bot Platform — Phase 36 Agent CRUD Dashboard
-- Adds: agents.temperature, agents.max_tokens (both NULL-able)
-- Why:  AGENT-02 requires optional generation config on the agent itself.
--       Migration 034 only added max_history. NULL semantics preserve the
--       Phase 34 runtime lock: when NULL, runtime uses its built-in defaults
--       (max_tokens=1024; temperature undefined → SDK default).
-- Decisions: D-36-02 (Generation section on agent edit form),
--            RESEARCH Q1 Option (a)
-- Notes: Additive only. No DEFAULT clause — NULL must be distinguishable
--        from "explicitly set to 0.7" in the runtime.
-- =============================================================================

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2) NULL,
  ADD COLUMN IF NOT EXISTS max_tokens  INTEGER      NULL;

-- Sanity bounds (cheap CHECK constraints — runtime also validates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_temperature_range'
  ) THEN
    ALTER TABLE public.agents
      ADD CONSTRAINT agents_temperature_range
      CHECK (temperature IS NULL OR (temperature >= 0 AND temperature <= 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_max_tokens_range'
  ) THEN
    ALTER TABLE public.agents
      ADD CONSTRAINT agents_max_tokens_range
      CHECK (max_tokens IS NULL OR (max_tokens >= 1 AND max_tokens <= 200000));
  END IF;
END $$;

COMMENT ON COLUMN public.agents.temperature IS
  'Optional generation temperature (0..2). NULL = use SDK / runtime default.';
COMMENT ON COLUMN public.agents.max_tokens IS
  'Optional generation max_tokens cap. NULL = use runtime default (1024).';
