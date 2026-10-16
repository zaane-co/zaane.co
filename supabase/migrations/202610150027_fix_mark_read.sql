-- Fix: zarn_mark_read began failing for everyone after 0022, because it runs as the caller and the caller may not
-- update delivered_at directly. Run it as the owner instead; it still only touches the caller's own rows.
create or replace function public.zarn_mark_read(c uuid) returns timestamptz language plpgsql security definer set search_path = '' as $$
declare t timestamptz := now();
begin
 update public.zarn_channel_members set last_read_at=t,delivered_at=t where channel_id=c and user_id=(select auth.uid()) and last_read_at<t;
 update public.zarn_mentions set read_at=t where channel_id=c and user_id=(select auth.uid()) and read_at is null;
 return t;
end $$;
revoke all on function public.zarn_mark_read(uuid) from public, anon;
grant execute on function public.zarn_mark_read(uuid) to authenticated;
