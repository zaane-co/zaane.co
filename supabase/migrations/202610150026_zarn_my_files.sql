-- ZARN personal files: uploaded to Files, private to the owner until they share them with specific people
-- (or deliberately post them in a chat).
create table public.zarn_files (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.zarn_members(user_id) on delete cascade,
 name text not null check(length(name) between 1 and 200),
 size integer not null default 0,
 type text not null default 'application/octet-stream',
 key text not null check(key like 'private/zarn/%'),
 created_at timestamptz not null default now());
create index zarn_files_owner on public.zarn_files(owner_id,created_at desc);

create table public.zarn_file_shares (
 file_id uuid not null references public.zarn_files(id) on delete cascade,
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(file_id,user_id));
create index zarn_file_shares_user on public.zarn_file_shares(user_id);

-- Helper functions avoid the two tables' policies referring to each other.
create function public.zarn_owns_file(f uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.zarn_files x where x.id=f and x.owner_id=(select auth.uid())) $$;
create function public.zarn_file_shared_with_me(f uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.zarn_file_shares s where s.file_id=f and s.user_id=(select auth.uid())) $$;

alter table public.zarn_files enable row level security;
alter table public.zarn_file_shares enable row level security;
create policy files_read on public.zarn_files for select to authenticated using(public.is_zarn_member() and (owner_id=(select auth.uid()) or public.zarn_file_shared_with_me(id)));
create policy files_add on public.zarn_files for insert to authenticated with check(owner_id=(select auth.uid()) and public.is_zarn_member());
create policy files_edit on public.zarn_files for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy files_remove on public.zarn_files for delete to authenticated using(owner_id=(select auth.uid()));
revoke update on public.zarn_files from authenticated;
grant update(name) on public.zarn_files to authenticated;

create policy shares_read on public.zarn_file_shares for select to authenticated using(public.is_zarn_member() and (user_id=(select auth.uid()) or public.zarn_owns_file(file_id)));
create policy shares_add on public.zarn_file_shares for insert to authenticated with check(public.zarn_owns_file(file_id)
 and exists(select 1 from public.zarn_members m where m.user_id=zarn_file_shares.user_id and m.deactivated_at is null and m.account_type='member'));
create policy shares_remove on public.zarn_file_shares for delete to authenticated using(user_id=(select auth.uid()) or public.zarn_owns_file(file_id));
