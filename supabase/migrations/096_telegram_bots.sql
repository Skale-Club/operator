-- Migration 096: Telegram bots — notifications + automation bot (SEED-034)
-- Adds a per-org Telegram bot configuration that powers both:
--   1. Notification workflow nodes (send_telegram_notification)
--   2. Automation bot mode (agent responds to DMs)
--
-- Stores the bot token AES-256-GCM encrypted (lib/crypto.ts). One active bot
-- per org via partial unique index. Extends conversations.channel CHECK to
-- include 'telegram'.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extend integration_provider enum with 'telegram' (idempotent)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'integration_provider'
      AND e.enumlabel = 'telegram'
  ) THEN
    ALTER TYPE public.integration_provider ADD VALUE 'telegram';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. telegram_bots: one active Telegram bot per organization
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.telegram_bots (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- AES-256-GCM encrypted bot token (lib/crypto.ts)
  bot_token_encrypted     text NOT NULL,

  -- Populated after /getMe succeeds
  bot_username            text,
  bot_name                text,

  -- Notification mode: chat IDs that receive workflow notifications
  -- e.g. ["-100123456789"] (group/channel) or ["123456789"] (DM)
  notification_chat_ids   text[] NOT NULL DEFAULT '{}',

  -- Automation mode: bot answers DMs using the configured agent
  automation_enabled      boolean NOT NULL DEFAULT false,
  agent_id                uuid REFERENCES public.agents(id) ON DELETE SET NULL,

  is_active               boolean NOT NULL DEFAULT true,
  webhook_set             boolean NOT NULL DEFAULT false,
  last_error              text,

  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- One active bot per org keeps the lookup deterministic
CREATE UNIQUE INDEX IF NOT EXISTS telegram_bots_org_active_idx
  ON public.telegram_bots (org_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS telegram_bots_org_idx
  ON public.telegram_bots (org_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_telegram_bots_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS telegram_bots_touch_updated_at ON public.telegram_bots;
CREATE TRIGGER telegram_bots_touch_updated_at
  BEFORE UPDATE ON public.telegram_bots
  FOR EACH ROW EXECUTE FUNCTION public.touch_telegram_bots_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — org members can read/write rows belonging to the active org
-- ---------------------------------------------------------------------------

ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members" ON public.telegram_bots;
CREATE POLICY "org members" ON public.telegram_bots
  FOR ALL TO authenticated
  USING  (org_id = public.get_current_org_id())
  WITH CHECK (org_id = public.get_current_org_id());

-- ---------------------------------------------------------------------------
-- 5. Extend conversations.channel CHECK to include 'telegram'
--    (Replaces the prior list — preserves the canonical channel set used by
--    the inbox UX, plus telegram. See SEED-034.)
-- ---------------------------------------------------------------------------

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_channel_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_channel_check
    CHECK (channel IN (
      'widget',
      'messenger',
      'instagram',
      'sms',
      'voice',
      'whatsapp',
      'telegram',
      -- Preserve legacy GHL-proxied channels still referenced in older orgs
      'ghl_sms',
      'ghl_whatsapp'
    ));

COMMIT;
