-- Studio roles: one super admin (the protected owner), plus Finance staff and Dev.
-- ZARN admin becomes its own flag on zarn_members, separate from Studio roles.

alter type public.staff_role add value if not exists 'finance_staff';
alter type public.staff_role add value if not exists 'dev';

-- 1. Only the protected owner account is super admin. Everyone else who was super admin becomes admin.
update public.users set role='admin' where role='super_admin' and not protected;
create unique index if not exists one_super_admin on public.users ((true)) where role='super_admin';

-- 2. Finance staff reads and writes the same data as finance (the app blocks deleting, bank details and settings).
--    Compared as text so this works in the same transaction that added the enum value.
create or replace function private.staff_role() returns text language sql stable security definer set search_path = '' as $$
 select case when role::text='finance_staff' then 'finance' else role::text end from public.users where id = (select auth.uid()) $$;

-- 3. Dev gets the content access editors and admins share (blog, site content, projects, media).
do $$
declare p record; q text; c text; n int := 0;
begin
 for p in select schemaname, tablename, policyname, qual, with_check from pg_policies
  where schemaname in ('public','storage') and (coalesce(qual,'') ~ $r$'admin'::text, 'editor'::text\]$r$ or coalesce(with_check,'') ~ $r$'admin'::text, 'editor'::text\]$r$) loop
  q := regexp_replace(p.qual, $r$'admin'::text, 'editor'::text\]$r$, $r$'admin'::text, 'editor'::text, 'dev'::text]$r$, 'g');
  c := regexp_replace(p.with_check, $r$'admin'::text, 'editor'::text\]$r$, $r$'admin'::text, 'editor'::text, 'dev'::text]$r$, 'g');
  execute format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
   || case when q is not null then format(' using (%s)', q) else '' end
   || case when c is not null then format(' with check (%s)', c) else '' end;
  n := n + 1;
 end loop;
 raise notice 'dev added to % content policies', n;
end $$;
-- Dev can edit site settings, but never the invoice/bank ones.
create policy dev_settings on public.settings for all to authenticated
 using ((select private.staff_role())='dev' and key not like 'invoice%')
 with check ((select private.staff_role())='dev' and key not like 'invoice%');

-- 4. ZARN admin: its own flag. Current Studio admins who are on ZARN keep ZARN admin.
alter table public.zarn_members add column if not exists is_admin boolean not null default false;
update public.zarn_members m set is_admin=true from public.users u where u.id=m.user_id and u.role::text in ('super_admin','admin');
create or replace function private.zarn_is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_zarn_member() and (
  exists(select 1 from public.zarn_members where user_id=(select auth.uid()) and is_admin)
  or exists(select 1 from public.users where id=(select auth.uid()) and role::text='super_admin')) $$;
