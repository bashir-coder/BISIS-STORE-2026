-- Public catalog read access and RLS initplan optimization.
-- Preserve each existing policy's command, roles, permissive mode and checks.
BEGIN;

DO $migration$
DECLARE
  p RECORD;
  role_list TEXT;
  create_sql TEXT;
  rewritten_qual TEXT;
  rewritten_check TEXT;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') LIKE '%auth.uid()%'
        OR coalesce(qual, '') LIKE '%auth.jwt()%'
        OR coalesce(with_check, '') LIKE '%auth.uid()%'
        OR coalesce(with_check, '') LIKE '%auth.jwt()%'
      )
  LOOP
    SELECT string_agg(quote_ident(r), ', ')
      INTO role_list
    FROM unnest(p.roles) AS r;

    rewritten_qual := p.qual;
    rewritten_check := p.with_check;

    IF rewritten_qual IS NOT NULL THEN
      rewritten_qual := replace(rewritten_qual, 'auth.uid()', '(select auth.uid())');
      rewritten_qual := replace(rewritten_qual, 'auth.jwt()', '(select auth.jwt())');
    END IF;

    IF rewritten_check IS NOT NULL THEN
      rewritten_check := replace(rewritten_check, 'auth.uid()', '(select auth.uid())');
      rewritten_check := replace(rewritten_check, 'auth.jwt()', '(select auth.jwt())');
    END IF;

    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename
    );

    create_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      p.policyname,
      p.schemaname,
      p.tablename,
      p.permissive,
      p.cmd,
      role_list
    );

    IF rewritten_qual IS NOT NULL THEN
      create_sql := create_sql || format(' USING (%s)', rewritten_qual);
    END IF;

    IF rewritten_check IS NOT NULL THEN
      create_sql := create_sql || format(' WITH CHECK (%s)', rewritten_check);
    END IF;

    EXECUTE create_sql;
  END LOOP;
END
$migration$;

-- These content tables are intentionally public catalog data.
DROP POLICY IF EXISTS "Public can view active FAQs" ON public.faqs;
CREATE POLICY "Public can view active FAQs"
  ON public.faqs FOR SELECT TO anon, authenticated
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS "Public can view active portfolio" ON public.portfolio;
CREATE POLICY "Public can view active portfolio"
  ON public.portfolio FOR SELECT TO anon, authenticated
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS "Public can read translations" ON public.translations;
CREATE POLICY "Public can read translations"
  ON public.translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS faqs_active_order_idx
  ON public.faqs (order_index)
  WHERE is_active IS TRUE;

CREATE INDEX IF NOT EXISTS portfolio_active_completed_idx
  ON public.portfolio (completed_at DESC)
  WHERE is_active IS TRUE;

NOTIFY pgrst, 'reload schema';
COMMIT;
