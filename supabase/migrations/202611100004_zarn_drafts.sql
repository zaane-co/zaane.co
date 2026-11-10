-- Unsent message drafts, saved per person so they follow you to every device.
create table if not exists public.zarn_drafts (
 user_id uuid not null references public.zarn_members(user_id) on delete cascade default auth.uid(),
 channel_id uuid not null references public.zarn_channels on delete cascade,
 parent_key text not null default '',
 body text not null check (length(body) <= 40000),
 updated_at timestamptz not null default now(),
 primary key (user_id, channel_id, parent_key)
);
alter table public.zarn_drafts enable row level security;
create policy own_drafts on public.zarn_drafts for all to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()) and private.zarn_can_read(channel_id));
grant select, insert, update, delete on public.zarn_drafts to authenticated;
