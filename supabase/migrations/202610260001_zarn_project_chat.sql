-- ZARN project chats: every project gets one conversation, shared by the project's members (and admins, who can open any project).
-- Its members follow the project's members automatically; nobody joins or leaves it directly.
begin;
alter table public.zarn_channels drop constraint zarn_channels_kind_check;
alter table public.zarn_channels add constraint zarn_channels_kind_check check(kind in ('public','private','dm','client','project'));
alter table public.zarn_channels drop constraint zarn_channels_name_check;
alter table public.zarn_channels add constraint zarn_channels_name_check check(kind in ('dm','client','project') or name ~ '^[a-z0-9][a-z0-9_-]{0,79}$');
alter table public.zarn_channels add column project_id uuid unique references public.zarn_projects on delete cascade;
alter table public.zarn_channels add constraint zarn_project_has_project check((kind='project')=(project_id is not null));

create or replace function public.zarn_can_post(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and (public.zarn_in_channel(c)
  or (public.zarn_is_admin() and exists(select 1 from public.zarn_channels where id=c and kind='client'))
  or exists(select 1 from public.zarn_channels where id=c and kind='project' and public.zarn_in_project(project_id))) $$;
create or replace function public.zarn_can_read(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and (public.zarn_in_channel(c)
  or (not public.zarn_is_guest() and exists(select 1 from public.zarn_channels where id=c and kind='public'))
  or (public.zarn_is_admin() and exists(select 1 from public.zarn_channels where id=c and kind='client'))
  or exists(select 1 from public.zarn_channels where id=c and kind='project' and public.zarn_in_project(project_id))) $$;

drop policy read_visible on public.zarn_channels;
create policy read_visible on public.zarn_channels for select to authenticated using(
 public.is_zarn_member() and ((kind='public' and not public.zarn_is_guest()) or public.zarn_in_channel(id) or (kind='client' and public.zarn_is_admin())
  or (kind='project' and public.zarn_in_project(project_id))));

-- The chat is named after its project and keeps that name.
create function public.zarn_project_chat() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then
  insert into public.zarn_channels(kind,project_id,name,created_by) values('project',new.id,new.name,new.created_by) on conflict(project_id) do nothing;
 elsif new.name is distinct from old.name then
  update public.zarn_channels set name=new.name where project_id=new.id;
 end if;
 return null;
end $$;
-- Named so it fires before zarn_project_creator, which adds the creator as the first member.
create trigger zarn_project_chat after insert or update of name on public.zarn_projects for each row execute function public.zarn_project_chat();

create function public.zarn_project_chat_members() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then
  insert into public.zarn_channel_members(channel_id,user_id) select c.id,new.user_id from public.zarn_channels c where c.project_id=new.project_id on conflict do nothing;
 else
  delete from public.zarn_channel_members cm using public.zarn_channels c where c.project_id=old.project_id and cm.channel_id=c.id and cm.user_id=old.user_id;
 end if;
 return null;
end $$;
create trigger zarn_project_chat_members after insert or delete on public.zarn_project_members for each row execute function public.zarn_project_chat_members();

-- Existing projects get their chat now.
insert into public.zarn_channels(kind,project_id,name,created_by) select 'project',p.id,p.name,p.created_by from public.zarn_projects p on conflict(project_id) do nothing;
insert into public.zarn_channel_members(channel_id,user_id) select c.id,pm.user_id from public.zarn_project_members pm join public.zarn_channels c on c.project_id=pm.project_id on conflict do nothing;

-- Project chats count every message as unread, like DMs and client spaces.
create or replace function public.zarn_unread() returns table(channel_id uuid, unread integer, mentions integer) language sql stable set search_path = '' as $$
 select cm.channel_id,
  (select count(*)::int from public.zarn_messages m where m.channel_id=cm.channel_id and (m.parent_id is null or ch.kind in ('dm','client','project')) and m.deleted_at is null and m.created_at>cm.last_read_at and m.user_id is distinct from cm.user_id),
  (select count(*)::int from public.zarn_mentions z where z.channel_id=cm.channel_id and z.user_id=cm.user_id and z.read_at is null)
 from public.zarn_channel_members cm join public.zarn_channels ch on ch.id=cm.channel_id where cm.user_id=(select auth.uid()) $$;

create or replace function public.zarn_unread_total(uid uuid) returns integer language sql stable security definer set search_path = '' as $$
 select coalesce(sum(case
   when cm.muted or ch.kind not in ('dm','client','project') then
    (select count(*) from public.zarn_mentions z where z.channel_id=cm.channel_id and z.user_id=cm.user_id and z.read_at is null)
   else
    (select count(*) from public.zarn_messages m where m.channel_id=cm.channel_id and m.deleted_at is null and m.created_at>cm.last_read_at and m.user_id is distinct from cm.user_id)
  end),0)::int
 from public.zarn_channel_members cm join public.zarn_channels ch on ch.id=cm.channel_id
 where cm.user_id=uid and ch.archived_at is null $$;
commit;
