-- =============================================================================
-- Development Seed: creates a test organization for local development
-- =============================================================================
-- Run after migration 001 to set up a usable dev environment.
--
-- NOTE: The auth.users record must be created via Supabase Auth first
--       (dashboard or signUp call). This seed only inserts into public tables —
--       auth.users is managed by Supabase Auth and cannot be seeded directly.
--
-- After creating a user via Supabase Auth, link them to this org:
--   INSERT INTO public.org_members (user_id, organization_id, role)
--   VALUES ('YOUR_AUTH_USER_UUID', '00000000-0000-0000-0000-000000000001', 'admin');

-- Test organization
INSERT INTO public.organizations (id, name, slug, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Organization',
  'test-org',
  true
)
ON CONFLICT (slug) DO NOTHING;
