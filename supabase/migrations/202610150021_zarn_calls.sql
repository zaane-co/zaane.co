-- 1:1 voice calls. State lives here (written by the server only); audio goes peer to peer over WebRTC.
create table public.zarn_calls (
 id uuid primary key default gen_random_uuid(),
 channel_id uuid not null references public.zarn_channels on delete cascade,
 caller_id uuid not null references public.zarn_members on delete cascade,
 callee_id uuid not null references public.zarn_members on delete cascade,
 status text not null default 'ringing' check (status in ('ringing','active','ended','missed','declined')),
 created_at timestamptz not null default now(),
 answered_at timestamptz,
 ended_at timestamptz
);
create index zarn_calls_caller_idx on public.zarn_calls(caller_id,status);
create index zarn_calls_callee_idx on public.zarn_calls(callee_id,status);
alter table public.zarn_calls enable row level security;
create policy parties_read on public.zarn_calls for select to authenticated using((select auth.uid()) in (caller_id,callee_id));
alter publication supabase_realtime add table public.zarn_calls;
