-- Align blog API slugs and public visibility with the existing blog_posts schema.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.blog_posts
SET slug = 'post-' || replace(id::text, '-', '')
WHERE slug IS NULL OR btrim(slug) = '';

DO $$
DECLARE
  duplicate_slug RECORD;
  unique_slug TEXT;
  suffix_number INTEGER;
BEGIN
  FOR duplicate_slug IN
    SELECT id, slug
    FROM (
      SELECT
        id,
        slug,
        row_number() OVER (PARTITION BY slug ORDER BY id) AS slug_rank
      FROM public.blog_posts
    ) ranked
    WHERE slug_rank > 1
    ORDER BY id
  LOOP
    unique_slug := left(duplicate_slug.slug, 150)
      || '-'
      || replace(duplicate_slug.id::text, '-', '');
    suffix_number := 0;

    WHILE EXISTS (
      SELECT 1
      FROM public.blog_posts
      WHERE slug = unique_slug
        AND id <> duplicate_slug.id
    ) LOOP
      suffix_number := suffix_number + 1;
      unique_slug := left(duplicate_slug.slug, 150)
        || '-'
        || replace(duplicate_slug.id::text, '-', '')
        || '-'
        || suffix_number::text;
    END LOOP;

    UPDATE public.blog_posts
    SET slug = unique_slug
    WHERE id = duplicate_slug.id;
  END LOOP;
END
$$;

ALTER TABLE public.blog_posts
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique_idx
  ON public.blog_posts (slug);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published blog posts"
  ON public.blog_posts;

CREATE POLICY "Anyone can view published blog posts"
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
