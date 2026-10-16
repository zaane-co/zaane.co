-- Client tasks: tasks that belong to a client's space. Only that client's team (and admins) can see them,
-- and they stay out of everyone's general To-dos.
alter table public.zarn_tasks add column lead_id uuid references public.leads(id) on delete cascade;
create index zarn_tasks_lead_idx on public.zarn_tasks(lead_id);

create function public.zarn_in_client(l uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and not public.zarn_is_guest() and (public.zarn_is_admin()
  or exists(select 1 from public.zarn_channels c where c.lead_id=l and c.kind='client' and public.zarn_in_channel(c.id))) $$;

create or replace function public.zarn_can_see_task(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and exists(select 1 from public.zarn_tasks k where k.id=t and (
  k.created_by=(select auth.uid()) or public.zarn_is_assignee(k.id)
  or (k.project_id is not null and public.zarn_in_project(k.project_id))
  or (k.lead_id is not null and public.zarn_in_client(k.lead_id)))) $$;

drop policy task_read on public.zarn_tasks;
drop policy task_add on public.zarn_tasks;
drop policy task_edit on public.zarn_tasks;
drop policy task_remove on public.zarn_tasks;
create policy task_read on public.zarn_tasks for select to authenticated using(public.zarn_is_team_member() and (created_by=(select auth.uid()) or public.zarn_is_assignee(id) or (project_id is not null and public.zarn_in_project(project_id)) or (lead_id is not null and public.zarn_in_client(lead_id))));
create policy task_add on public.zarn_tasks for insert to authenticated with check(created_by=(select auth.uid()) and public.zarn_is_team_member() and (project_id is null or public.zarn_in_project(project_id)) and (lead_id is null or public.zarn_in_client(lead_id)));
create policy task_edit on public.zarn_tasks for update to authenticated using(public.zarn_is_team_member() and (created_by=(select auth.uid()) or public.zarn_is_assignee(id) or (project_id is not null and public.zarn_in_project(project_id)) or (lead_id is not null and public.zarn_in_client(lead_id))))
 with check(public.zarn_is_team_member() and (project_id is null or public.zarn_in_project(project_id)) and (lead_id is null or public.zarn_in_client(lead_id)));
create policy task_remove on public.zarn_tasks for delete to authenticated using(public.zarn_is_team_member() and (created_by=(select auth.uid()) or (project_id is not null and public.zarn_in_project(project_id)) or (lead_id is not null and public.zarn_in_client(lead_id))));

-- Assigning a client task: the person must be on that client's team.
drop policy ta_add on public.zarn_task_assignees;
create policy ta_add on public.zarn_task_assignees for insert to authenticated with check(public.zarn_is_team_member() and public.zarn_can_see_task(task_id)
 and exists(select 1 from public.zarn_tasks t where t.id=zarn_task_assignees.task_id and t.project_id is not distinct from zarn_task_assignees.project_id)
 and ((project_id is not null and exists(select 1 from public.zarn_project_members pm where pm.project_id=zarn_task_assignees.project_id and pm.user_id=zarn_task_assignees.user_id))
   or (project_id is null and exists(select 1 from public.zarn_members m where m.user_id=zarn_task_assignees.user_id and m.deactivated_at is null and m.account_type='member')))
 and not exists(select 1 from public.zarn_tasks t where t.id=zarn_task_assignees.task_id and t.lead_id is not null
   and not exists(select 1 from public.zarn_channels c join public.zarn_channel_members cm on cm.channel_id=c.id where c.lead_id=t.lead_id and c.kind='client' and cm.user_id=zarn_task_assignees.user_id)));
