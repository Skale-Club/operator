-- =============================================================================
-- Migration 061: Migrate contacts.tags text[] → contact_tags junction table
--
-- Reads every non-empty string in contacts.tags, creates a tag entity for each
-- unique (org_id, normalised-slug) pair, then inserts rows in contact_tags.
--
-- Idempotent: ON CONFLICT DO NOTHING on both inserts.
-- contacts.tags text[] is intentionally left intact here — migration 062 drops
-- it after the application layer is confirmed to use the new tables.
-- =============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_name   text;
  v_slug   text;
  v_tag_id uuid;
BEGIN

  -- Step 1: Create a tags entity for every unique (org_id, slug) found in contacts.tags
  FOR v_org_id, v_name, v_slug IN
    SELECT DISTINCT
      c.org_id,
      trim(t.tag)                                                                AS name,
      lower(regexp_replace(trim(t.tag), '[^a-z0-9]+', '-', 'gi'))               AS slug
    FROM public.contacts c
    CROSS JOIN LATERAL unnest(c.tags) AS t(tag)
    WHERE trim(t.tag) <> ''
  LOOP
    INSERT INTO public.tags (org_id, name, slug, color)
    VALUES (v_org_id, v_name, v_slug, '#6B7280')
    ON CONFLICT (org_id, slug) DO NOTHING;
  END LOOP;

  -- Step 2: Populate contact_tags from every (contact, tag-string) pair
  INSERT INTO public.contact_tags (contact_id, tag_id)
  SELECT DISTINCT
    c.id,
    tg.id
  FROM public.contacts c
  CROSS JOIN LATERAL unnest(c.tags) AS t(tag)
  JOIN public.tags tg
    ON tg.org_id = c.org_id
   AND tg.slug   = lower(regexp_replace(trim(t.tag), '[^a-z0-9]+', '-', 'gi'))
  WHERE trim(t.tag) <> ''
  ON CONFLICT DO NOTHING;

END $$;
