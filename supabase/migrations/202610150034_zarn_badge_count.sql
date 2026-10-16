-- The number on the app icon counts what we notify about: unread direct messages and client chats, plus @mentions anywhere.
-- Ordinary channel chatter doesn't count, so the badge stays accurate while the app is closed (it is set by each push).
create or replace function public.zarn_unread_total(uid uuid) returns integer language sql stable security definer set search_path = '' as $$
 select coalesce(sum(case
   when cm.muted or ch.kind not in ('dm','client') then
    (select count(*) from public.zarn_mentions z where z.channel_id=cm.channel_id and z.user_id=cm.user_id and z.read_at is null)
   else
    (select count(*) from public.zarn_messages m where m.channel_id=cm.channel_id and m.parent_id is null and m.deleted_at is null and m.created_at>cm.last_read_at and m.user_id is distinct from cm.user_id)
  end),0)::int
 from public.zarn_channel_members cm join public.zarn_channels ch on ch.id=cm.channel_id
 where cm.user_id=uid and ch.archived_at is null $$;
