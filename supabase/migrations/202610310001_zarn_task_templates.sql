-- ZARN to-do templates: a named, ordered list of tasks (grouped into phases) that anyone on the team can drop into a project or their to-dos.
-- items is [{title, phase?, description?, priority?}]. Everyone on the team can use a template; only its author or an admin changes it.
create table public.zarn_task_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 80),
 description text not null default '' check(length(description)<=300),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 300),
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
create index zarn_task_templates_name on public.zarn_task_templates(name);

alter table public.zarn_task_templates enable row level security;
create policy read_team on public.zarn_task_templates for select to authenticated using(public.zarn_is_team_member());
create policy add_team on public.zarn_task_templates for insert to authenticated with check(created_by=(select auth.uid()) and public.zarn_is_team_member());
create policy edit_own on public.zarn_task_templates for update to authenticated using(public.zarn_is_team_member() and (created_by=(select auth.uid()) or public.zarn_is_admin())) with check(public.zarn_is_team_member() and (created_by=(select auth.uid()) or public.zarn_is_admin()));
create policy delete_own on public.zarn_task_templates for delete to authenticated using(public.zarn_is_team_member() and (created_by=(select auth.uid()) or public.zarn_is_admin()));
