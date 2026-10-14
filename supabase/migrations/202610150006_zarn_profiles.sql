-- Slack-style profiles: @username, work email, hotline, and an emergency contact (members only, never guests).
begin;
alter table public.zarn_members
 add column username text unique check(username ~ '^[a-z0-9][a-z0-9._]{1,29}$'),
 add column phone text not null default '' check(length(phone)<=40),
 add column work_email text not null default '' check(length(work_email)<=254);
grant update(username,phone,work_email) on public.zarn_members to authenticated;

-- Give existing members a username from their email (isaac.o@... -> isaac.o), de-duplicated with a number.
do $$ declare r record; base text; cand text; n int; begin
 for r in select user_id,email from public.zarn_members where username is null order by created_at loop
  base:=left(regexp_replace(lower(split_part(r.email,'@',1)),'[^a-z0-9._]','','g'),26);
  if length(base)<2 or base !~ '^[a-z0-9]' then base:='member'; end if;
  cand:=base;n:=1;
  while exists(select 1 from public.zarn_members where username=cand) loop n:=n+1;cand:=base||n; end loop;
  update public.zarn_members set username=cand where user_id=r.user_id;
 end loop;
end $$;

create table public.zarn_emergency (
 user_id uuid primary key references public.zarn_members on delete cascade,
 name text not null default '' check(length(name)<=80),
 relation text not null default '' check(length(relation)<=40),
 phone text not null default '' check(length(phone)<=40),
 updated_at timestamptz not null default now());
alter table public.zarn_emergency enable row level security;
create policy read_team on public.zarn_emergency for select to authenticated using(user_id=(select auth.uid()) or (public.is_zarn_member() and not public.zarn_is_guest()));
create policy write_own on public.zarn_emergency for insert to authenticated with check(user_id=(select auth.uid()) and public.is_zarn_member());
create policy edit_own on public.zarn_emergency for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
commit;
