-- 072_email_marketing.sql
-- Email Marketing: reusable section library, templates, and template-section assembly.

-- ─── email_sections (shared building blocks) ─────────────────────────────────

CREATE TABLE public.email_sections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  type         text        NOT NULL DEFAULT 'custom'
                           CHECK (type IN ('header','footer','hero','cta','text','image','divider','social','custom')),
  html_content text        NOT NULL DEFAULT '',
  is_global    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_email_sections" ON public.email_sections
  USING  (org_id = public.get_current_org_id())
  WITH CHECK (org_id = public.get_current_org_id());

CREATE INDEX ON public.email_sections (org_id, is_global);

CREATE TRIGGER trg_email_sections_updated_at
  BEFORE UPDATE ON public.email_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── email_templates ──────────────────────────────────────────────────────────

CREATE TABLE public.email_templates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  subject_line text        NOT NULL DEFAULT '',
  preview_text text        NOT NULL DEFAULT '',
  ai_prompt    text,
  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','ready','archived')),
  tags         text[]      NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_email_templates" ON public.email_templates
  USING  (org_id = public.get_current_org_id())
  WITH CHECK (org_id = public.get_current_org_id());

CREATE INDEX ON public.email_templates (org_id, status);
CREATE INDEX ON public.email_templates (org_id, created_at DESC);

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── email_template_sections (ordered sections inside a template) ─────────────
-- section_id NOT NULL → links a shared section; html_content overrides it when non-empty
-- section_id NULL     → inline section with its own html_content

CREATE TABLE public.email_template_sections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid        NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  section_id   uuid        REFERENCES public.email_sections(id) ON DELETE SET NULL,
  type         text        NOT NULL DEFAULT 'custom'
                           CHECK (type IN ('header','footer','hero','cta','text','image','divider','social','custom')),
  name         text        NOT NULL,
  html_content text        NOT NULL DEFAULT '',
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_email_template_sections" ON public.email_template_sections
  USING (
    EXISTS (
      SELECT 1 FROM public.email_templates t
      WHERE t.id = email_template_sections.template_id
        AND t.org_id = public.get_current_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_templates t
      WHERE t.id = email_template_sections.template_id
        AND t.org_id = public.get_current_org_id()
    )
  );

CREATE INDEX ON public.email_template_sections (template_id, sort_order);

CREATE TRIGGER trg_email_template_sections_updated_at
  BEFORE UPDATE ON public.email_template_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
