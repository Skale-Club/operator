-- Migration 097: SEED-035 — Conversation Inbox UX
-- Adds read/unread tracking, starred, expanded status (5 values + wait_until snooze),
-- and a labels system for conversations.

-- 1. Read/Unread per user
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own reads" ON conversation_reads;
CREATE POLICY "own reads" ON conversation_reads
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS conversation_reads_user_idx
  ON conversation_reads(user_id);

CREATE INDEX IF NOT EXISTS conversation_reads_conversation_idx
  ON conversation_reads(conversation_id);

-- 2. Starred (favorite) — independent of pinned
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT false;

-- 3. wait_until for status='waiting' (snooze)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS wait_until TIMESTAMPTZ;

-- 4. Expanded status — open | pending | waiting | resolved | closed
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('open', 'pending', 'waiting', 'resolved', 'closed'));

-- 5. Conversation labels
CREATE TABLE IF NOT EXISTS conversation_labels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366F1',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS conversation_labels_org_idx
  ON conversation_labels(org_id);

CREATE TABLE IF NOT EXISTS conversation_label_assignments (
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  label_id         UUID NOT NULL REFERENCES conversation_labels(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, label_id)
);

CREATE INDEX IF NOT EXISTS conversation_label_assignments_label_idx
  ON conversation_label_assignments(label_id);

ALTER TABLE conversation_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_label_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members labels" ON conversation_labels;
CREATE POLICY "org members labels" ON conversation_labels
  USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());

DROP POLICY IF EXISTS "org members label assignments" ON conversation_label_assignments;
CREATE POLICY "org members label assignments" ON conversation_label_assignments
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND c.org_id = get_current_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND c.org_id = get_current_org_id()
    )
  );

-- 6. Trigger: any new message invalidates ALL conversation_reads for that conv.
-- Keeps the logic simple — visitor messages are the dominant case and a single
-- DELETE is faster than per-user reasoning. The user who sent the message will
-- re-mark-as-read on their next open (or stays "unread" briefly, which is fine).
CREATE OR REPLACE FUNCTION invalidate_conversation_reads()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM conversation_reads
  WHERE conversation_id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_conversation_reads ON conversation_messages;
CREATE TRIGGER trg_invalidate_conversation_reads
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION invalidate_conversation_reads();
