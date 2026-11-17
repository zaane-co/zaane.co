-- Share a folder in My Drive with people (view or edit). Everything inside the folder, at any depth,
-- follows the folder: people it is shared with can open it, and editors can add, rename and move things in it.
-- The owner of a folder also sees what others add inside it.
create table public.zarn_drive_folder_members (
 folder_id uuid not null references public.zarn_drive_folders(id) on delete cascade,
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 role text not null default 'view' check(role in ('view','edit')),
 created_at timestamptz not null default now(),
 primary key(folder_id,user_id));
create index zarn_drive_folder_members_user on public.zarn_drive_folder_members(user_id);

-- The caller's access to a folder through its tree: 'owner' if they own it or any folder above it,
-- else the best role it (or a folder above it) is shared with them at, else null.
create function private.zarn_tree_role(f uuid) returns text language sql stable security definer set search_path='' as $$
 with recursive up as (
  select x.id,x.parent_id,x.owner_id,0 as depth from public.zarn_drive_folders x where x.id=f
  union all select p.id,p.parent_id,p.owner_id,up.depth+1 from public.zarn_drive_folders p join up on p.id=up.parent_id where up.depth<50
 ), r as (
  select 'owner'::text as role from up where up.owner_id=(select auth.uid())
  union all select m.role from public.zarn_drive_folder_members m join up on m.folder_id=up.id where m.user_id=(select auth.uid())
 )
 select case when not private.is_zarn_member() then null
  when exists(select 1 from r where role='owner') then 'owner' when exists(select 1 from r where role='edit') then 'edit' when exists(select 1 from r) then 'view' end $$;

-- Folders
drop policy folders_read on public.zarn_drive_folders;
drop policy folders_edit on public.zarn_drive_folders;
drop policy folders_remove on public.zarn_drive_folders;
create policy folders_read on public.zarn_drive_folders for select to authenticated
 using(private.zarn_drive_ok(drive,owner_id,lead_id) or private.zarn_tree_role(id) is not null);
create policy folders_edit on public.zarn_drive_folders for update to authenticated
 using(private.zarn_drive_ok(drive,owner_id,lead_id) or private.zarn_tree_role(id) in ('owner','edit'))
 with check(private.zarn_drive_ok(drive,owner_id,lead_id) or private.zarn_tree_role(id) in ('owner','edit'));
create policy folders_remove on public.zarn_drive_folders for delete to authenticated
 using(private.zarn_drive_admin(drive,owner_id) or private.zarn_tree_role(parent_id)='owner');

-- Files
create or replace function private.zarn_file_ok(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.zarn_files x where x.id=f and private.is_zarn_member() and (
  x.owner_id=(select auth.uid())
  or exists(select 1 from public.zarn_file_shares s where s.file_id=x.id and s.user_id=(select auth.uid()))
  or (x.drive<>'my' and private.zarn_drive_ok(x.drive,x.owner_id,x.lead_id))
  or (x.folder_id is not null and private.zarn_tree_role(x.folder_id) is not null))) $$;
drop policy files_edit on public.zarn_files;
drop policy files_remove on public.zarn_files;
create policy files_edit on public.zarn_files for update to authenticated
 using(owner_id=(select auth.uid()) or (drive<>'my' and private.zarn_drive_ok(drive,owner_id,lead_id)) or (folder_id is not null and private.zarn_tree_role(folder_id) in ('owner','edit')))
 with check(owner_id=(select auth.uid()) or (drive<>'my' and private.zarn_drive_ok(drive,owner_id,lead_id)) or (folder_id is not null and private.zarn_tree_role(folder_id) in ('owner','edit')));
create policy files_remove on public.zarn_files for delete to authenticated
 using(private.zarn_drive_admin(drive,owner_id) or (folder_id is not null and private.zarn_tree_role(folder_id)='owner'));

-- Docs
create or replace function public.zarn_doc_role(d uuid) returns text language sql stable security definer set search_path='' as $$
 with r as (
  select 'owner'::text as role where private.is_zarn_member() and exists(select 1 from public.zarn_docs x where x.id=d and x.owner_id=(select auth.uid()))
  union all select m.role from public.zarn_doc_members m where private.is_zarn_member() and m.doc_id=d and m.user_id=(select auth.uid())
  union all select x.team_role from public.zarn_docs x where x.id=d and x.visibility='team' and private.is_zarn_member() and not private.zarn_is_guest()
  union all select x.team_role from public.zarn_docs x where x.id=d and x.lead_id is not null and private.is_zarn_member()
   and exists(select 1 from public.zarn_channels c where c.lead_id=x.lead_id and c.kind='client' and private.zarn_in_channel(c.id))
  union all select 'edit'::text from public.zarn_docs x where x.id=d and x.drive<>'my' and private.zarn_drive_ok(x.drive,x.owner_id,x.lead_id)
  union all select case when private.zarn_tree_role(x.folder_id)='view' then 'view' else 'edit' end from public.zarn_docs x
   where x.id=d and x.folder_id is not null and private.zarn_tree_role(x.folder_id) is not null
 )
 select case when exists(select 1 from r where role='owner') then 'owner' when exists(select 1 from r where role='edit') then 'edit' when exists(select 1 from r) then 'view' end $$;
drop policy delete_docs on public.zarn_docs;
create policy delete_docs on public.zarn_docs for delete to authenticated
 using(private.zarn_drive_admin(drive,owner_id) or (folder_id is not null and private.zarn_tree_role(folder_id)='owner'));

-- Placing things: a folder you can edit through sharing counts as a place you can add to.
create or replace function private.zarn_folder_place() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.zarn_drive_folders; cur uuid; hops int:=0;
begin
 new.updated_at:=now();
 if tg_op='UPDATE' and new.parent_id is not distinct from old.parent_id and new.drive=old.drive and new.lead_id is not distinct from old.lead_id then return new; end if;
 if new.parent_id is not null then
  select * into f from public.zarn_drive_folders where id=new.parent_id;
  if f.id is null or f.trashed_at is not null then raise exception 'That folder is not available'; end if;
  if (select auth.uid()) is not null and pg_trigger_depth()<=1 and not (private.zarn_drive_ok(f.drive,f.owner_id,f.lead_id) or private.zarn_tree_role(f.id) in ('owner','edit')) then raise exception 'You cannot add to that folder'; end if;
  new.drive:=f.drive;new.lead_id:=f.lead_id;
  cur:=new.parent_id;
  while cur is not null and hops<100 loop
   if cur=new.id then raise exception 'A folder cannot go inside itself'; end if;
   select parent_id into cur from public.zarn_drive_folders where id=cur; hops:=hops+1;
  end loop;
 else
  if new.drive<>'client' then new.lead_id:=null; end if;
  if (select auth.uid()) is not null and not private.zarn_drive_ok(new.drive,new.owner_id,new.lead_id) then raise exception 'You cannot put that in this drive'; end if;
 end if;
 return new;
end $$;

create or replace function private.zarn_item_place() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.zarn_drive_folders; is_doc boolean:=tg_table_name='zarn_docs';
begin
 if not is_doc then new.updated_at:=now(); end if;
 if tg_op='UPDATE' and new.folder_id is not distinct from old.folder_id and new.drive=old.drive
  and (is_doc or new.lead_id is not distinct from old.lead_id) then return new; end if;
 if pg_trigger_depth()>1 then return new; end if;
 if new.folder_id is not null then
  select * into f from public.zarn_drive_folders where id=new.folder_id;
  if f.id is null or f.trashed_at is not null then raise exception 'That folder is not available'; end if;
  if (select auth.uid()) is not null and not (private.zarn_drive_ok(f.drive,f.owner_id,f.lead_id) or private.zarn_tree_role(f.id) in ('owner','edit')) then raise exception 'You cannot add to that folder'; end if;
  new.drive:=f.drive;
  if not is_doc or f.drive='client' then new.lead_id:=f.lead_id; end if;
 else
  if not is_doc and new.drive<>'client' then new.lead_id:=null; end if;
  if is_doc and new.drive='client' and new.lead_id is null then raise exception 'Pick a client'; end if;
  if (select auth.uid()) is not null and not private.zarn_drive_ok(new.drive,new.owner_id,new.lead_id) then raise exception 'You cannot put that in this drive'; end if;
 end if;
 return new;
end $$;

-- Who a folder is shared with: the folder's owner manages it; people see their own row.
alter table public.zarn_drive_folder_members enable row level security;
create policy fm_read on public.zarn_drive_folder_members for select to authenticated
 using(user_id=(select auth.uid()) or private.zarn_tree_role(folder_id)='owner');
create policy fm_add on public.zarn_drive_folder_members for insert to authenticated
 with check(private.zarn_tree_role(folder_id)='owner'
  and exists(select 1 from public.zarn_drive_folders x where x.id=folder_id and x.drive='my')
  and exists(select 1 from public.zarn_members m where m.user_id=zarn_drive_folder_members.user_id and m.deactivated_at is null and m.account_type='member'));
create policy fm_edit on public.zarn_drive_folder_members for update to authenticated
 using(private.zarn_tree_role(folder_id)='owner') with check(private.zarn_tree_role(folder_id)='owner');
create policy fm_remove on public.zarn_drive_folder_members for delete to authenticated
 using(user_id=(select auth.uid()) or private.zarn_tree_role(folder_id)='owner');
