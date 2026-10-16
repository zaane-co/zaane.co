-- Web push for ZARN: one row per browser/phone a member has allowed notifications on.
create table public.zarn_push_subscriptions (
 endpoint text primary key,
 user_id uuid not null references public.zarn_members on delete cascade,
 p256dh text not null,
 auth text not null,
 created_at timestamptz not null default now()
);
create index zarn_push_user_idx on public.zarn_push_subscriptions(user_id);
alter table public.zarn_push_subscriptions enable row level security;
-- No policies: only the server (service role) reads or writes these.

-- Unread count for one member (muted conversations only count @mentions); used for the app-icon badge.
create function public.zarn_unread_total(uid uuid) returns integer language sql stable security definer set search_path = '' as $$
 select coalesce(sum(case when cm.muted then
   (select count(*) from public.zarn_mentions z where z.channel_id=cm.channel_id and z.user_id=cm.user_id and z.read_at is null)
  else
   (select count(*) from public.zarn_messages m where m.channel_id=cm.channel_id and m.parent_id is null and m.deleted_at is null and m.created_at>cm.last_read_at and m.user_id is distinct from cm.user_id)
  end),0)::int
 from public.zarn_channel_members cm where cm.user_id=uid $$;
revoke all on function public.zarn_unread_total(uuid) from public,anon,authenticated;
