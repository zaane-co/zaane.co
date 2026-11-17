-- In-house projects: grouped, archivable, with their own documentation and vault.

-- Groups hold projects (e.g. "Products", "Internal tools"). Any team member can see and create them.
create table public.zarn_project_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 60),
 color text not null default '#52525b' check(color ~ '^#[0-9a-f]{6}$'),
 position double precision not null default extract(epoch from now()),
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now());
alter table public.zarn_project_groups enable row level security;
create policy pg_read on public.zarn_project_groups for select to authenticated using(private.is_zarn_member() and not private.zarn_is_guest());
create policy pg_add on public.zarn_project_groups for insert to authenticated with check(created_by=(select auth.uid()) and private.is_zarn_member() and not private.zarn_is_guest());
create policy pg_edit on public.zarn_project_groups for update to authenticated using(created_by=(select auth.uid()) or private.zarn_is_admin()) with check(created_by=(select auth.uid()) or private.zarn_is_admin());
create policy pg_remove on public.zarn_project_groups for delete to authenticated using(created_by=(select auth.uid()) or private.zarn_is_admin());

alter table public.zarn_projects
 add column group_id uuid references public.zarn_project_groups(id) on delete set null,
 add column archived_at timestamptz;
create index zarn_projects_group on public.zarn_projects(group_id);
grant update(group_id,archived_at) on public.zarn_projects to authenticated;

-- Documentation: docs (and sheets) that belong to a project. Everyone on the project can open and edit them.
alter table public.zarn_docs add column project_id uuid references public.zarn_projects(id) on delete cascade;
create index zarn_docs_project on public.zarn_docs(project_id);
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
  union all select 'edit'::text from public.zarn_docs x where x.id=d and x.project_id is not null and private.is_zarn_member() and private.zarn_in_project(x.project_id)
 )
 select case when exists(select 1 from r where role='owner') then 'owner' when exists(select 1 from r where role='edit') then 'edit' when exists(select 1 from r) then 'view' end $$;

-- Vault: items and the activity log can belong to a client or to a project (exactly one).
alter table public.zarn_vault_items alter column lead_id drop not null;
alter table public.zarn_vault_items add column project_id uuid references public.zarn_projects(id) on delete cascade;
alter table public.zarn_vault_items add constraint zarn_vault_items_owner check((lead_id is null)<>(project_id is null));
create index zarn_vault_items_project on public.zarn_vault_items(project_id);
alter table public.zarn_vault_log alter column lead_id drop not null;
alter table public.zarn_vault_log add column project_id uuid references public.zarn_projects(id) on delete cascade;
create index zarn_vault_log_project on public.zarn_vault_log(project_id,at desc);
