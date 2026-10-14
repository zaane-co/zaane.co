-- Read receipts: "seen" is each member's last_read_at in the channel. Stamp it with the server clock
-- (phones can be minutes off) and mark that channel's mentions read in the same call.
create function public.zarn_mark_read(c uuid) returns timestamptz language plpgsql set search_path = '' as $$
declare t timestamptz := now();
begin
 update public.zarn_channel_members set last_read_at=t where channel_id=c and user_id=(select auth.uid()) and last_read_at<t;
 update public.zarn_mentions set read_at=t where channel_id=c and user_id=(select auth.uid()) and read_at is null;
 return t;
end $$;
revoke all on function public.zarn_mark_read(uuid) from public, anon;
grant execute on function public.zarn_mark_read(uuid) to authenticated;
-- Realtime UPDATE events must carry the full row so other members see who read when.
alter table public.zarn_channel_members replica identity full;
