-- Replies inside a thread in a DM or client space count as unread (they are as important as the main chat there).
-- In ordinary channels only top-level messages count, plus @mentions anywhere.
create or replace function public.zarn_unread() returns table(channel_id uuid, unread integer, mentions integer) language sql stable set search_path = '' as $$
 select cm.channel_id,
  (select count(*)::int from public.zarn_messages m where m.channel_id=cm.channel_id and (m.parent_id is null or ch.kind in ('dm','client')) and m.deleted_at is null and m.created_at>cm.last_read_at and m.user_id is distinct from cm.user_id),
  (select count(*)::int from public.zarn_mentions z where z.channel_id=cm.channel_id and z.user_id=cm.user_id and z.read_at is null)
 from public.zarn_channel_members cm join public.zarn_channels ch on ch.id=cm.channel_id where cm.user_id=(select auth.uid()) $$;

create or replace function public.zarn_unread_total(uid uuid) returns integer language sql stable security definer set search_path = '' as $$
 select coalesce(sum(case
   when cm.muted or ch.kind not in ('dm','client') then
    (select count(*) from public.zarn_mentions z where z.channel_id=cm.channel_id and z.user_id=cm.user_id and z.read_at is null)
   else
    (select count(*) from public.zarn_messages m where m.channel_id=cm.channel_id and m.deleted_at is null and m.created_at>cm.last_read_at and m.user_id is distinct from cm.user_id)
  end),0)::int
 from public.zarn_channel_members cm join public.zarn_channels ch on ch.id=cm.channel_id
 where cm.user_id=uid and ch.archived_at is null $$;
