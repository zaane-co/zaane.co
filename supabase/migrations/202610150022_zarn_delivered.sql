-- Delivery receipts: "delivered" is when the recipient's app had the message (they were online, or opened ZARN later).
-- Stamped with the server clock by the recipient's own app; "seen" is still last_read_at.
alter table public.zarn_channel_members add column delivered_at timestamptz not null default now();
create function public.zarn_mark_delivered(c uuid default null) returns void language sql security definer set search_path = '' as $$
 update public.zarn_channel_members set delivered_at=now()
 where user_id=(select auth.uid()) and (c is null or channel_id=c) and delivered_at<now() $$;
revoke all on function public.zarn_mark_delivered(uuid) from public, anon;
grant execute on function public.zarn_mark_delivered(uuid) to authenticated;
-- Opening a conversation also counts as delivered.
create or replace function public.zarn_mark_read(c uuid) returns timestamptz language plpgsql set search_path = '' as $$
declare t timestamptz := now();
begin
 update public.zarn_channel_members set last_read_at=t,delivered_at=t where channel_id=c and user_id=(select auth.uid()) and last_read_at<t;
 update public.zarn_mentions set read_at=t where channel_id=c and user_id=(select auth.uid()) and read_at is null;
 return t;
end $$;
