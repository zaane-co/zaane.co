-- Private channels: people are invited and must accept; they are not added automatically.
create table public.zarn_channel_invites (
 channel_id uuid not null references public.zarn_channels on delete cascade,
 user_id uuid not null references public.zarn_members on delete cascade,
 invited_by uuid references public.zarn_members on delete set null,
 created_at timestamptz not null default now(),
 primary key (channel_id,user_id)
);
alter table public.zarn_channel_invites enable row level security;
-- People see their own invitations; everything is written by the server.
create policy read_own on public.zarn_channel_invites for select to authenticated using(user_id=(select auth.uid()));
alter publication supabase_realtime add table public.zarn_channel_invites;
