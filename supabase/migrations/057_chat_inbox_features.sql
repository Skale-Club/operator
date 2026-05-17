-- 057_chat_inbox_features.sql
-- SEED-011 / v2.2 Chat Inbox Redesign
--
-- Adds three columns to `conversations`:
--   - `pinned`     boolean   — admin can pin a conversation; pinned conversations
--                              float to the top of the inbox list.
--   - `priority`   text      — 'normal' (default), 'high', 'urgent'. Drives the
--                              colored left-border on conversation cards.
--   - `typing_at`  timestamptz — last typing broadcast received from the agent
--                                side. Used as a fallback for the typing
--                                indicator; the primary signal is Realtime
--                                broadcast (no DB write), so this column is
--                                optional state for debugging / recovery.
--
-- Two partial indexes keep the inbox list fast:
--   - pinned conversations (always shown at top)
--   - non-normal priority (so we can sort/filter quickly)
--
-- Indexes are partial — they only cover the rows that actually need fast access
-- (`pinned = true` or `priority != 'normal'`), keeping write cost minimal.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS priority text
  CHECK (priority IN ('normal', 'high', 'urgent'))
  DEFAULT 'normal';

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS typing_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_conversations_pinned
  ON conversations (org_id, pinned, updated_at DESC)
  WHERE pinned = true;

CREATE INDEX IF NOT EXISTS idx_conversations_priority
  ON conversations (org_id, priority, updated_at DESC)
  WHERE priority != 'normal';
