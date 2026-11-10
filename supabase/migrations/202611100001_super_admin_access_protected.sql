-- 1. Super admins reach everything in ZARN: every private channel (read, post, join), every client, every project, the CRM.
--    Other people's DMs stay private.
-- 2. Protected accounts (the Zaane owner account) can't be deleted, demoted, deactivated or removed from ZARN, by anyone, from anywhere.

-- 1.
create or replace function private.zarn_is_super() returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_zarn_member() and exists(select 1 from public.users where id=(select auth.uid()) and role='super_admin') $$;
revoke execute on function private.zarn_is_super() from public, anon;
grant execute on function private.zarn_is_super() to authenticated;

create or replace function private.zarn_can_read(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_zarn_member() and (private.zarn_in_channel(c)
  or (not private.zarn_is_guest() and exists(select 1 from public.zarn_channels where id=c and kind='public'))
  or (private.zarn_is_admin() and exists(select 1 from public.zarn_channels where id=c and kind='client'))
  or (private.zarn_is_super() and exists(select 1 from public.zarn_channels where id=c and kind='private'))
  or exists(select 1 from public.zarn_channels where id=c and kind='project' and private.zarn_in_project(project_id))) $$;

create or replace function private.zarn_can_post(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_zarn_member() and (private.zarn_in_channel(c)
  or (private.zarn_is_admin() and exists(select 1 from public.zarn_channels where id=c and kind='client'))
  or (private.zarn_is_super() and exists(select 1 from public.zarn_channels where id=c and kind='private'))
  or exists(select 1 from public.zarn_channels where id=c and kind='project' and private.zarn_in_project(project_id))) $$;

create or replace function private.zarn_can_crm() returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_zarn_member() and (private.zarn_is_super() or coalesce((select can_view_crm from public.zarn_members where user_id=(select auth.uid())),false)) $$;

drop policy read_visible on public.zarn_channels;
create policy read_visible on public.zarn_channels for select to authenticated using(
 private.is_zarn_member() and ((kind='public' and not private.zarn_is_guest()) or private.zarn_in_channel(id)
  or (kind='client' and private.zarn_is_admin())
  or (kind='private' and private.zarn_is_super())
  or (kind='project' and private.zarn_in_project(project_id))));

drop policy join_public on public.zarn_channel_members;
create policy join_public on public.zarn_channel_members for insert to authenticated with check(
 user_id=(select auth.uid()) and private.is_zarn_member() and not private.zarn_is_guest()
 and exists(select 1 from public.zarn_channels c where c.id=channel_id and c.archived_at is null
  and (c.kind='public' or (c.kind='private' and private.zarn_is_super()))));

-- 2.
alter table public.users add column if not exists protected boolean not null default false;
update public.users set protected=true where email='zaane.co@gmail.com';

create or replace function private.guard_protected_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='DELETE' then
  if old.protected then raise exception 'This account is protected and can''t be deleted.'; end if;
  return old;
 end if;
 -- Only a direct SQL migration (not the app, not the API) can change the flag.
 if new.protected is distinct from old.protected and current_user not in ('postgres','supabase_admin') then
  raise exception 'The protected flag can only be changed by the database owner.';
 end if;
 if old.protected and new.protected and new.role is distinct from 'super_admin' then
  raise exception 'This account is protected and must stay a super admin.';
 end if;
 return new;
end $$;
drop trigger if exists guard_protected_user on public.users;
create trigger guard_protected_user before update or delete on public.users for each row execute function private.guard_protected_user();

create or replace function private.guard_protected_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if exists(select 1 from public.users where id=old.id and protected) then raise exception 'This account is protected and can''t be deleted.'; end if;
 return old;
end $$;
drop trigger if exists guard_protected_auth_user on auth.users;
create trigger guard_protected_auth_user before delete on auth.users for each row execute function private.guard_protected_auth_user();

create or replace function private.guard_protected_zarn_member() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.users where id=old.user_id and protected) then return coalesce(new,old); end if;
 if tg_op='DELETE' then raise exception 'This account is protected and can''t be removed from ZARN.'; end if;
 if new.deactivated_at is not null then raise exception 'This account is protected and can''t be deactivated.'; end if;
 if new.account_type<>'member' then raise exception 'This account is protected and must stay a full member.'; end if;
 return new;
end $$;
drop trigger if exists guard_protected_zarn_member on public.zarn_members;
create trigger guard_protected_zarn_member before update or delete on public.zarn_members for each row execute function private.guard_protected_zarn_member();

revoke execute on function private.guard_protected_user() from public, anon, authenticated;
revoke execute on function private.guard_protected_auth_user() from public, anon, authenticated;
revoke execute on function private.guard_protected_zarn_member() from public, anon, authenticated;
