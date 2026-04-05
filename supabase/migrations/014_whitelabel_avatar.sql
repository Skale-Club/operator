-- Add widget_avatar_url to organizations for whitelabeling
ALTER TABLE public.organizations
ADD COLUMN widget_avatar_url text;
