-- Baris.Flow security baseline:
-- Browser clients may know the public anon key, but unauthenticated requests
-- must never read or mutate application data.

DO $security$
DECLARE
    target_table record;
    existing_policy record;
BEGIN
    FOR target_table IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
            target_table.tablename
        );

        FOR existing_policy IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = target_table.tablename
        LOOP
            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON public.%I',
                existing_policy.policyname,
                target_table.tablename
            );
        END LOOP;

        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            'authenticated_all_access',
            target_table.tablename
        );

        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', target_table.tablename);
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
            target_table.tablename
        );
    END LOOP;
END
$security$;

DO $views$
DECLARE
    target_view record;
BEGIN
    FOR target_view IN
        SELECT viewname
        FROM pg_views
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', target_view.viewname);
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', target_view.viewname);
    END LOOP;
END
$views$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
