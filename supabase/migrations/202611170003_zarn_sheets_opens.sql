-- Sheets are stored as docs with kind='sheet' (content holds the sheet as JSON), so sharing, folders,
-- drives, trash and links all work the same.
alter table public.zarn_docs add column kind text not null default 'doc' check(kind in ('doc','sheet'));

-- When each person last opened something, for Drive's Recent list.
create table public.zarn_drive_opens (
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 kind text not null check(kind in ('doc','file')),
 item_id uuid not null,
 opened_at timestamptz not null default now(),
 primary key(user_id,kind,item_id));
alter table public.zarn_drive_opens enable row level security;
create policy opens_own on public.zarn_drive_opens for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and private.is_zarn_member());
