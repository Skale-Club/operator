-- =============================================================================
-- Migration 046: org_invites table
-- Phase: 42-google-sso
-- Requirements: AUTH-03, AUTH-07
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Section 1: org_invites table
-- Stores email invitations from org admins. First OAuth login of an invited
-- email auto-creates the org_members row and marks accepted_at.
-- ---------------------------------------------------------------------------

CREATE TABLE public.org_invites (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID              NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email       TEXT              NOT NULL,
  role        public.user_role  NOT NULL DEFAULT 'member',
  invited_by  UUID              REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at  TIMESTAMPTZ       NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  UNIQUE(org_id, email)
);

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Index for O(1) email lookup in OAuth callback
CREATE INDEX idx_org_invites_email ON public.org_invites(lower(email));
CREATE INDEX idx_org_invites_org_id ON public.org_invites(org_id);

-- ---------------------------------------------------------------------------
-- Section 2: RLS policies for org_invites
-- Only admins of the org can read and manage invites.
-- Admin check: user has an org_members row with role = 'admin' for this org.
-- ---------------------------------------------------------------------------

-- SELECT: org admins can view invites for their org
CREATE POLICY "org_invites_select" ON public.org_invites
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT public.get_current_org_id())
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = (SELECT auth.uid())
        AND organization_id = (SELECT public.get_current_org_id())
        AND role = 'admin'
    )
  );

-- INSERT: org admins can create invites
CREATE POLICY "org_invites_insert" ON public.org_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.get_current_org_id())
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = (SELECT auth.uid())
        AND organization_id = (SELECT public.get_current_org_id())
        AND role = 'admin'
    )
  );

-- UPDATE: org admins can update invites (e.g., revoke, modify role)
CREATE POLICY "org_invites_update" ON public.org_invites
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.get_current_org_id())
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = (SELECT auth.uid())
        AND organization_id = (SELECT public.get_current_org_id())
        AND role = 'admin'
    )
  )
  WITH CHECK (
    org_id = (SELECT public.get_current_org_id())
  );

-- DELETE: org admins can revoke pending invites
CREATE POLICY "org_invites_delete" ON public.org_invites
  FOR DELETE TO authenticated
  USING (
    org_id = (SELECT public.get_current_org_id())
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = (SELECT auth.uid())
        AND organization_id = (SELECT public.get_current_org_id())
        AND role = 'admin'
    )
  );
