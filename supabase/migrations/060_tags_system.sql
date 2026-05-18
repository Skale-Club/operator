-- =============================================================================
-- Migration 060: Tags System (SEED-013)
--
-- Introduces entity-based tags to replace the contacts.tags text[] column.
-- Three tables:
--   * tags              — org-scoped tag entity with name + color
--   * contact_tags      — M:N between contacts and tags
--   * opportunity_tags  — M:N between opportunities and tags
--
-- contacts.tags text[] is left in place for now and will be dropped in
-- migration 062 after data migration (061) is confirmed.
-- =============================================================================

-- ─── tags ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tags (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       text        NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 80),
  slug       text        NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*$'),
  color      text        NOT NULL DEFAULT '#6B7280'
                         CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tags_org ON public.tags (org_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_org_isolation ON public.tags;
CREATE POLICY tags_org_isolation ON public.tags
  FOR ALL TO authenticated
  USING      (org_id = (SELECT public.get_current_org_id()))
  WITH CHECK (org_id = (SELECT public.get_current_org_id()));

-- ─── contact_tags ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_tags (
  contact_id uuid        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id     uuid        NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  tagged_at  timestamptz NOT NULL DEFAULT now(),
  tagged_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON public.contact_tags (tag_id);

ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_tags_org_isolation ON public.contact_tags;
CREATE POLICY contact_tags_org_isolation ON public.contact_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id
        AND c.org_id = (SELECT public.get_current_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id
        AND c.org_id = (SELECT public.get_current_org_id())
    )
  );

-- ─── opportunity_tags ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.opportunity_tags (
  opportunity_id uuid        NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tag_id         uuid        NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  tagged_at      timestamptz NOT NULL DEFAULT now(),
  tagged_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (opportunity_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_tags_tag ON public.opportunity_tags (tag_id);

ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunity_tags_org_isolation ON public.opportunity_tags;
CREATE POLICY opportunity_tags_org_isolation ON public.opportunity_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_id
        AND o.org_id = (SELECT public.get_current_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_id
        AND o.org_id = (SELECT public.get_current_org_id())
    )
  );

-- ─── helper: tag usage counts ─────────────────────────────────────────────────
-- Returns how many contacts and opportunities use each tag (org-scoped).

CREATE OR REPLACE FUNCTION public.get_tag_usage(p_org_id uuid)
RETURNS TABLE (
  tag_id            uuid,
  contact_count     bigint,
  opportunity_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    t.id AS tag_id,
    COUNT(DISTINCT ct.contact_id)     AS contact_count,
    COUNT(DISTINCT ot.opportunity_id) AS opportunity_count
  FROM public.tags t
  LEFT JOIN public.contact_tags ct     ON ct.tag_id = t.id
  LEFT JOIN public.opportunity_tags ot ON ot.tag_id = t.id
  WHERE t.org_id = p_org_id
  GROUP BY t.id;
$$;
