-- Move authorization helpers out of the exposed public schema.
-- Keep this schema out of Supabase Data API exposed schemas.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.execution_role()
returns text language sql stable security definer set search_path = ''
as $function$
  select u.role from public.users as u
  where u.id = auth.uid() and u.is_active = true limit 1;
$function$;

create or replace function private.execution_is_staff()
returns boolean language sql stable security definer set search_path = ''
as $function$
  select private.execution_role() in ('admin', 'super_admin', 'manager', 'editor');
$function$;

create or replace function private.execution_can_access_project(p_project_id bigint)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select private.execution_role() = 'super_admin'
    or exists (
      select 1 from public.projects as p
      join public.workspace_members as wm on wm.workspace_id = p.workspace_id
      where p.id = p_project_id and wm.user_id = auth.uid()
    );
$function$;

create or replace function private.execution_client_can_access_project(p_project_id bigint)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.projects as p
    join public.orders as o on o.project_id = p.id
    where p.id = p_project_id and o.user_id = auth.uid()
  );
$function$;

-- Repoint all current public RLS policies before dropping the old public helpers.
do $migration$
declare
  r record;
  v_qual text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%execution_role(%'
        or coalesce(qual, '') like '%execution_is_staff(%'
        or coalesce(qual, '') like '%execution_can_access_project(%'
        or coalesce(qual, '') like '%execution_client_can_access_project(%'
        or coalesce(with_check, '') like '%execution_role(%'
        or coalesce(with_check, '') like '%execution_is_staff(%'
        or coalesce(with_check, '') like '%execution_can_access_project(%'
        or coalesce(with_check, '') like '%execution_client_can_access_project(%'
      )
  loop
    v_qual := case when r.qual is null then null else
      replace(replace(replace(replace(r.qual,
        'execution_role(', 'private.execution_role('),
        'execution_is_staff(', 'private.execution_is_staff('),
        'execution_can_access_project(', 'private.execution_can_access_project('),
        'execution_client_can_access_project(', 'private.execution_client_can_access_project(')
      end;
    v_check := case when r.with_check is null then null else
      replace(replace(replace(replace(r.with_check,
        'execution_role(', 'private.execution_role('),
        'execution_is_staff(', 'private.execution_is_staff('),
        'execution_can_access_project(', 'private.execution_can_access_project('),
        'execution_client_can_access_project(', 'private.execution_client_can_access_project(')
      end;
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end
$migration$;

revoke all on function private.execution_role() from public;
revoke all on function private.execution_is_staff() from public;
revoke all on function private.execution_can_access_project(bigint) from public;
revoke all on function private.execution_client_can_access_project(bigint) from public;
grant execute on function private.execution_role() to anon, authenticated, service_role;
grant execute on function private.execution_is_staff() to anon, authenticated, service_role;
grant execute on function private.execution_can_access_project(bigint) to anon, authenticated, service_role;
grant execute on function private.execution_client_can_access_project(bigint) to anon, authenticated, service_role;

drop function public.execution_role();
drop function public.execution_is_staff();
drop function public.execution_can_access_project(bigint);
drop function public.execution_client_can_access_project(bigint);
