-- Slack-style status: emoji + text + when it clears (null = until cleared).
alter table public.zarn_members
 add column status_emoji text not null default '' check(length(status_emoji)<=16),
 add column status_until timestamptz;
grant update(status_emoji,status_until) on public.zarn_members to authenticated;
