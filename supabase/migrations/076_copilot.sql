-- =============================================================================
-- Migration 076: Natural-Language CRM Copilot (SEED-020 / v3.1 Milestone A)
--
-- Tables backing the chat-with-your-CRM copilot:
--   * copilot_conversations — one row per chat session
--   * copilot_messages      — message stream (parts-jsonb pattern, Vercel chatbot)
--   * copilot_runs          — per-turn audit (tokens, cost, status)
--   * copilot_tool_calls    — per-tool-call trace (input, output, duration)
--
-- All tables: org-scoped RLS via public.get_current_org_id().
-- =============================================================================

-- ─── copilot_conversations ───────────────────────────────────────────────────

CREATE TABLE public.copilot_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'New conversation',
  visibility  text        NOT NULL DEFAULT 'private'
              CHECK (visibility IN ('private','shared')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_copilot_conversations" ON public.copilot_conversations
  USING      (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

CREATE INDEX ON public.copilot_conversations (org_id, created_at DESC);

CREATE TRIGGER trg_copilot_conversations_updated_at
  BEFORE UPDATE ON public.copilot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── copilot_messages ────────────────────────────────────────────────────────
-- The `parts` array preserves the exact sequence of text + tool-call blocks
-- emitted by the model, mirroring the Vercel chatbot template's parts pattern.

CREATE TABLE public.copilot_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
  role            text        NOT NULL
                  CHECK (role IN ('user','assistant')),
  parts           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_copilot_messages" ON public.copilot_messages
  USING (
    EXISTS (
      SELECT 1 FROM public.copilot_conversations c
      WHERE c.id = copilot_messages.conversation_id
        AND c.org_id = (SELECT public.get_current_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.copilot_conversations c
      WHERE c.id = copilot_messages.conversation_id
        AND c.org_id = (SELECT public.get_current_org_id())
    )
  );

CREATE INDEX ON public.copilot_messages (conversation_id, created_at);

-- ─── copilot_runs ────────────────────────────────────────────────────────────
-- Per-turn execution record. One assistant message may span 1-12 model calls;
-- a run captures the aggregate (tokens, cost, status, duration).

CREATE TABLE public.copilot_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id     uuid        NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
  provider            text        NOT NULL,
  model               text        NOT NULL,
  input_tokens        integer     NOT NULL DEFAULT 0,
  output_tokens       integer     NOT NULL DEFAULT 0,
  estimated_cost_usd  numeric(10,4) NOT NULL DEFAULT 0,
  status              text        NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running','succeeded','failed')),
  error               text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_copilot_runs" ON public.copilot_runs
  USING      (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

CREATE INDEX ON public.copilot_runs (conversation_id, created_at);
CREATE INDEX ON public.copilot_runs (org_id, created_at DESC);

-- ─── copilot_tool_calls ──────────────────────────────────────────────────────
-- Fine-grained per-tool-call trace for the run debug view.

CREATE TABLE public.copilot_tool_calls (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid        NOT NULL REFERENCES public.copilot_runs(id) ON DELETE CASCADE,
  tool_name   text        NOT NULL,
  input       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  output      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error       text,
  status      text        NOT NULL DEFAULT 'succeeded'
              CHECK (status IN ('succeeded','failed')),
  duration_ms integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_copilot_tool_calls" ON public.copilot_tool_calls
  USING (
    EXISTS (
      SELECT 1 FROM public.copilot_runs r
      WHERE r.id = copilot_tool_calls.run_id
        AND r.org_id = (SELECT public.get_current_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.copilot_runs r
      WHERE r.id = copilot_tool_calls.run_id
        AND r.org_id = (SELECT public.get_current_org_id())
    )
  );

CREATE INDEX ON public.copilot_tool_calls (run_id, created_at);
