-- ZARN Drive: folders, drives, stars and trash on top of the existing docs and files.
-- Every doc, file and folder lives in one drive:
--   my     the owner's own drive (private unless shared item by item)
--   team   the company shared drive (every team member can open and edit)
--   client a client's shared drive (everyone in that client's space)

create table public.zarn_drive_folders (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 120),
 parent_id uuid references public.zarn_drive_folders(id) on delete cascade,
 owner_id uuid not null references public.zarn_members(user_id) on delete cascade,
 drive text not null default 'my' check(drive in ('my','team','client')),
 lead_id uuid references public.leads(id) on delete cascade,
 color text check(color ~ '^#[0-9a-fA-F]{6}$'),
 trashed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((drive='client')=(lead_id is not null)));
create index zarn_drive_folders_parent on public.zarn_drive_folders(parent_id);
create index zarn_drive_folders_owner on public.zarn_drive_folders(owner_id);
create index zarn_drive_folders_lead on public.zarn_drive_folders(lead_id);

alter table public.zarn_docs
 add column drive text not null default 'my' check(drive in ('my','team','client')),
 add column folder_id uuid references public.zarn_drive_folders(id) on delete cascade,
 add column trashed_at timestamptz;
create index zarn_docs_folder on public.zarn_docs(folder_id);

alter table public.zarn_files
 add column drive text not null default 'my' check(drive in ('my','team','client')),
 add column lead_id uuid references public.leads(id) on delete cascade,
 add column folder_id uuid references public.zarn_drive_folders(id) on delete cascade,
 add column trashed_at timestamptz,
 add column updated_at timestamptz not null default now(),
 add constraint zarn_files_drive_lead check((drive='client')=(lead_id is not null));
create index zarn_files_folder on public.zarn_files(folder_id);

-- Stars are per person.
create table public.zarn_drive_stars (
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 kind text not null check(kind in ('doc','file','folder')),
 item_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,kind,item_id));

-- Can the caller open things in this drive?
create function private.zarn_drive_ok(d text, owner uuid, lead uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_zarn_member() and case d
  when 'my' then owner=(select auth.uid())
  when 'team' then not private.zarn_is_guest()
  when 'client' then lead is not null and private.zarn_in_client(lead)
  else false end $$;
-- Can the caller remove things for good in this drive? Owners always; in shared drives also ZARN admins.
create function private.zarn_drive_admin(d text, owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select owner=(select auth.uid()) or (d<>'my' and private.zarn_is_admin()) $$;

create function private.zarn_folder_ok(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.zarn_drive_folders x where x.id=f and private.zarn_drive_ok(x.drive,x.owner_id,x.lead_id)) $$;

-- Docs: a doc in a shared drive is editable by everyone in that drive.
create or replace function public.zarn_doc_role(d uuid) returns text language sql stable security definer set search_path='' as $$
 with r as (
  select 'owner'::text as role where private.is_zarn_member() and exists(select 1 from public.zarn_docs x where x.id=d and x.owner_id=(select auth.uid()))
  union all select m.role from public.zarn_doc_members m where private.is_zarn_member() and m.doc_id=d and m.user_id=(select auth.uid())
  union all select x.team_role from public.zarn_docs x where x.id=d and x.visibility='team' and private.is_zarn_member() and not private.zarn_is_guest()
  union all select x.team_role from public.zarn_docs x where x.id=d and x.lead_id is not null and private.is_zarn_member()
   and exists(select 1 from public.zarn_channels c where c.lead_id=x.lead_id and c.kind='client' and private.zarn_in_channel(c.id))
  union all select 'edit'::text from public.zarn_docs x where x.id=d and x.drive<>'my' and private.zarn_drive_ok(x.drive,x.owner_id,x.lead_id)
 )
 select case when exists(select 1 from r where role='owner') then 'owner' when exists(select 1 from r where role='edit') then 'edit' when exists(select 1 from r) then 'view' end $$;

-- Files: owner, people it is shared with, or anyone in its shared drive.
create function private.zarn_file_ok(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.zarn_files x where x.id=f and private.is_zarn_member() and (
  x.owner_id=(select auth.uid())
  or exists(select 1 from public.zarn_file_shares s where s.file_id=x.id and s.user_id=(select auth.uid()))
  or (x.drive<>'my' and private.zarn_drive_ok(x.drive,x.owner_id,x.lead_id)))) $$;

drop policy files_read on public.zarn_files;
drop policy files_edit on public.zarn_files;
drop policy files_remove on public.zarn_files;
create policy files_read on public.zarn_files for select to authenticated using(private.zarn_file_ok(id));
create policy files_edit on public.zarn_files for update to authenticated
 using(owner_id=(select auth.uid()) or (drive<>'my' and private.zarn_drive_ok(drive,owner_id,lead_id)))
 with check(owner_id=(select auth.uid()) or (drive<>'my' and private.zarn_drive_ok(drive,owner_id,lead_id)));
create policy files_remove on public.zarn_files for delete to authenticated using(private.zarn_drive_admin(drive,owner_id));
grant update(name,drive,lead_id,folder_id,trashed_at) on public.zarn_files to authenticated;

-- Docs: allow moving and trashing (the trigger below checks the destination).
grant update(drive,folder_id,trashed_at) on public.zarn_docs to authenticated;
drop policy delete_docs on public.zarn_docs;
create policy delete_docs on public.zarn_docs for delete to authenticated using(private.zarn_drive_admin(drive,owner_id));

alter table public.zarn_drive_folders enable row level security;
create policy folders_read on public.zarn_drive_folders for select to authenticated using(private.zarn_drive_ok(drive,owner_id,lead_id));
create policy folders_add on public.zarn_drive_folders for insert to authenticated
 with check(owner_id=(select auth.uid()) and not private.zarn_is_guest() and private.zarn_drive_ok(drive,owner_id,lead_id));
create policy folders_edit on public.zarn_drive_folders for update to authenticated
 using(private.zarn_drive_ok(drive,owner_id,lead_id)) with check(private.zarn_drive_ok(drive,owner_id,lead_id));
create policy folders_remove on public.zarn_drive_folders for delete to authenticated using(private.zarn_drive_admin(drive,owner_id));
revoke update on public.zarn_drive_folders from authenticated;
grant update(name,parent_id,drive,lead_id,color,trashed_at) on public.zarn_drive_folders to authenticated;

alter table public.zarn_drive_stars enable row level security;
create policy stars_own on public.zarn_drive_stars for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and private.is_zarn_member());

-- Placing a folder: inside a parent it takes the parent's drive; never inside itself.
create function private.zarn_folder_place() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.zarn_drive_folders; cur uuid; hops int:=0;
begin
 new.updated_at:=now();
 if tg_op='UPDATE' and new.parent_id is not distinct from old.parent_id and new.drive=old.drive and new.lead_id is not distinct from old.lead_id then return new; end if;
 if new.parent_id is not null then
  select * into f from public.zarn_drive_folders where id=new.parent_id;
  if f.id is null or f.trashed_at is not null then raise exception 'That folder is not available'; end if;
  if (select auth.uid()) is not null and not private.zarn_drive_ok(f.drive,f.owner_id,f.lead_id) then raise exception 'You cannot add to that folder'; end if;
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

-- When a folder changes drive, everything inside follows it.
create function private.zarn_folder_cascade() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.drive is distinct from old.drive or new.lead_id is distinct from old.lead_id then
  update public.zarn_drive_folders set drive=new.drive,lead_id=new.lead_id where parent_id=new.id;
  update public.zarn_files set drive=new.drive,lead_id=new.lead_id where folder_id=new.id;
  update public.zarn_docs set drive=new.drive,lead_id=case when new.drive='client' then new.lead_id else lead_id end where folder_id=new.id;
 end if;
 return null;
end $$;

-- Placing a doc or file: inside a folder it takes that folder's drive; at a drive's root the caller must belong to that drive.
create function private.zarn_item_place() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.zarn_drive_folders; is_doc boolean:=tg_table_name='zarn_docs'; lead uuid;
begin
 if not is_doc then new.updated_at:=now(); end if;
 if tg_op='UPDATE' and new.folder_id is not distinct from old.folder_id and new.drive=old.drive
  and (is_doc or new.lead_id is not distinct from old.lead_id) then return new; end if;
 -- Moves triggered by a parent folder changing drive are already checked there.
 if pg_trigger_depth()>1 then return new; end if;
 if new.folder_id is not null then
  select * into f from public.zarn_drive_folders where id=new.folder_id;
  if f.id is null or f.trashed_at is not null then raise exception 'That folder is not available'; end if;
  if (select auth.uid()) is not null and not private.zarn_drive_ok(f.drive,f.owner_id,f.lead_id) then raise exception 'You cannot add to that folder'; end if;
  new.drive:=f.drive;
  if not is_doc or f.drive='client' then new.lead_id:=f.lead_id; end if;
 else
  if not is_doc and new.drive<>'client' then new.lead_id:=null; end if;
  if is_doc and new.drive='client' and new.lead_id is null then raise exception 'Pick a client'; end if;
  if (select auth.uid()) is not null and not private.zarn_drive_ok(new.drive,new.owner_id,new.lead_id) then raise exception 'You cannot put that in this drive'; end if;
 end if;
 return new;
end $$;

create trigger zarn_folder_place before insert or update on public.zarn_drive_folders for each row execute function private.zarn_folder_place();
create trigger zarn_folder_cascade after update on public.zarn_drive_folders for each row execute function private.zarn_folder_cascade();
create trigger zarn_doc_place before insert or update on public.zarn_docs for each row execute function private.zarn_item_place();
create trigger zarn_file_place before insert or update on public.zarn_files for each row execute function private.zarn_item_place();

-- Existing client docs belong to that client's drive.
update public.zarn_docs set drive='client' where lead_id is not null;
