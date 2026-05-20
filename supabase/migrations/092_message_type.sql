-- Migration 092: Add message_type column to conversation_messages
-- and drop the orphan typing_at column from conversations.
-- SEED-030: Chat Rich Messages

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text','image','audio','video','document','sticker','location','mixed'));

COMMENT ON COLUMN conversation_messages.message_type IS
  'Primary content type of the message. "mixed" when text + media coexist.';

-- Drop orphan column that was never written to
ALTER TABLE conversations DROP COLUMN IF EXISTS typing_at;
