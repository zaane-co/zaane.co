-- To-dos become shared tasks: a task may belong to no project, can be assigned to teammates, and has comments.
alter table public.zarn_tasks alter column project_id drop not null;
alter table public.zarn_task_assignees alter column project_id drop not null;

create function public.zarn_is_assignee(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.zarn_task_assignees a where a.task_id=t and a.user_id=(select auth.uid())) $$;
-- Visible to its creator, anyone assigned to it, and everyone in its project.
create function public.zarn_can_see_task(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and exists(select 1 from public.zarn_tasks k where k.id=t and (
  k.created_by=(select auth.uid()) or public.zarn_is_assignee(k.id) or (k.project_id is not null and public.zarn_in_project(k.project_id)))) $$;
create function public.zarn_is_team_member() returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and coalesce((select m.account_type from public.zarn_members m where m.user_id=(select auth.uid())),'guest')='member' $$;

drop policy task_read on public.zarn_tasks;
drop policy task_add on public.zarn_tasks;
drop policy task_edit on public.zarn_tasks;
drop policy task_remove on public.zarn_tasks;
create policy task_read on public.zarn_tasks for select to authenticated using(public.zarn_is_team_member() and (created_by=(select auth.uid()) or public.zarn_is_assignee(id) or (project_id is not null and public.zarn_in_project(project_id))));
create policy task_add on public.zarn_tasks for insert to authenticated with check(created_by=(select auth.uid()) and public.zarn_is_team_member() and (project_id is null or public.zarn_in_project(project_id)));
create policy task_edit on public.zarn_tasks for update to authenticated using(public.zarn_is_team_member() and (created_by=(select auth.uid()) or public.zarn_is_assignee(id) or (project_id is not null and public.zarn_in_project(project_id))))
 with check(public.zarn_is_team_member() and (project_id is null or public.zarn_in_project(project_id)));
create policy task_remove on public.zarn_tasks for delete to authenticated using(public.zarn_is_team_member() and (created_by=(select auth.uid()) or (project_id is not null and public.zarn_in_project(project_id))));

drop policy ta_read on public.zarn_task_assignees;
drop policy ta_add on public.zarn_task_assignees;
drop policy ta_remove on public.zarn_task_assignees;
create policy ta_read on public.zarn_task_assignees for select to authenticated using(public.zarn_is_team_member() and public.zarn_can_see_task(task_id));
create policy ta_add on public.zarn_task_assignees for insert to authenticated with check(public.zarn_is_team_member() and public.zarn_can_see_task(task_id)
 and exists(select 1 from public.zarn_tasks t where t.id=zarn_task_assignees.task_id and t.project_id is not distinct from zarn_task_assignees.project_id)
 and ((project_id is not null and exists(select 1 from public.zarn_project_members pm where pm.project_id=zarn_task_assignees.project_id and pm.user_id=zarn_task_assignees.user_id))
   or (project_id is null and exists(select 1 from public.zarn_members m where m.user_id=zarn_task_assignees.user_id and m.deactivated_at is null and m.account_type='member'))));
create policy ta_remove on public.zarn_task_assignees for delete to authenticated using(public.zarn_is_team_member() and public.zarn_can_see_task(task_id));

create table public.zarn_task_comments (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.zarn_tasks(id) on delete cascade,
 user_id uuid references public.zarn_members(user_id) on delete set null,
 body text not null check(length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now());
create index zarn_task_comments_task on public.zarn_task_comments(task_id,created_at);
alter table public.zarn_task_comments enable row level security;
create policy tc_read on public.zarn_task_comments for select to authenticated using(public.zarn_is_team_member() and public.zarn_can_see_task(task_id));
create policy tc_add on public.zarn_task_comments for insert to authenticated with check(user_id=(select auth.uid()) and public.zarn_is_team_member() and public.zarn_can_see_task(task_id));
create policy tc_remove on public.zarn_task_comments for delete to authenticated using(user_id=(select auth.uid()));

-- Move the personal to-dos that already exist into tasks (assigned to their owner). Saved messages stay in zarn_todos.
do $$
declare r record; t uuid;
begin
 for r in select * from public.zarn_todos where message_id is null loop
  insert into public.zarn_tasks(title,description,status,priority,start_at,due_at,created_by,created_at,position)
   values(left(r.body,200),r.description,case r.status when 'done' then 'done' when 'in_progress' then 'in_progress' else 'todo' end,r.priority,r.start_at,r.due_at,r.user_id,r.created_at,extract(epoch from r.created_at))
   returning id into t;
  insert into public.zarn_task_assignees(task_id,user_id,project_id) values(t,r.user_id,null);
  delete from public.zarn_todos where id=r.id;
 end loop;
end $$;
