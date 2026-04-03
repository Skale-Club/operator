-- =============================================================================
-- Migration 006: API Key Admin
-- Phase: 06-api-key-admin
-- Extends integration_provider enum with AI/telephony provider types so
-- admins can store OpenAI, Anthropic, OpenRouter, and Vapi credentials
-- in the integrations table (no more hardcoded env vars on hot paths).
-- =============================================================================

ALTER TYPE public.integration_provider ADD VALUE IF NOT EXISTS 'openai';
ALTER TYPE public.integration_provider ADD VALUE IF NOT EXISTS 'anthropic';
ALTER TYPE public.integration_provider ADD VALUE IF NOT EXISTS 'openrouter';
ALTER TYPE public.integration_provider ADD VALUE IF NOT EXISTS 'vapi';
