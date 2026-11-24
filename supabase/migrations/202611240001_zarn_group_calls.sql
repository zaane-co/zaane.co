-- Group calls: a call can hold many people. Anyone in the chat is rung, more people can be added mid-call,
-- and team members can join from a link. Media still goes straight between people (each to each).
alter table public.zarn_calls alter column callee_id drop not null;
alter table public.zarn_calls add column kind text not null default 'direct' check (kind in ('direct','group'));

create table public.zarn_call_people (
 call_id uuid not null references public.zarn_calls on delete cascade,
 user_id uuid not null references public.zarn_members on delete cascade,
 status text not null default 'ringing' check (status in ('ringing','joined','left','declined','missed')),
 invited_by uuid references public.zarn_members on delete set null,
 created_at timestamptz not null default now(),
 joined_at timestamptz,
 left_at timestamptz,
 -- Updated while someone is in the call, so a closed tab doesn't keep a call open forever.
 seen_at timestamptz,
 primary key (call_id,user_id)
);
create index zarn_call_people_user on public.zarn_call_people(user_id,status);

-- Earlier one-to-one calls get their two people, so history reads the same way for every call.
insert into public.zarn_call_people(call_id,user_id,status,created_at,joined_at,left_at)
 select id,caller_id,'left',created_at,created_at,ended_at from public.zarn_calls
on conflict do nothing;
insert into public.zarn_call_people(call_id,user_id,status,created_at,joined_at,left_at)
 select id,callee_id,case when status in ('ended','active') then 'left' when status='declined' then 'declined' else 'missed' end,created_at,answered_at,ended_at
 from public.zarn_calls where callee_id is not null
on conflict do nothing;

create function public.zarn_in_call(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.zarn_call_people where call_id=c and user_id=(select auth.uid())) $$;

alter table public.zarn_call_people enable row level security;
create policy people_read on public.zarn_call_people for select to authenticated using(public.zarn_in_call(call_id));
revoke all on public.zarn_call_people from anon, authenticated;
grant select on public.zarn_call_people to authenticated;

-- People see calls they were part of, and calls going on right now in chats they belong to (to join them).
drop policy parties_read on public.zarn_calls;
create policy call_read on public.zarn_calls for select to authenticated using(
 (select auth.uid()) in (caller_id,callee_id) or public.zarn_in_call(id) or (status in ('ringing','active') and public.zarn_in_channel(channel_id)));

alter publication supabase_realtime add table public.zarn_call_people;
