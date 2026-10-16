-- ZARN projects: shared task boards (list, kanban, timeline) with assignees, plus a demo project to try.
create table public.zarn_projects (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 80),
 description text not null default '' check(length(description)<=500),
 color text not null default '#c40a3a' check(color ~ '^#[0-9a-f]{6}$'),
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now());

create table public.zarn_project_members (
 project_id uuid not null references public.zarn_projects(id) on delete cascade,
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 added_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(project_id,user_id));
create index zarn_project_members_user on public.zarn_project_members(user_id);

create table public.zarn_tasks (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.zarn_projects(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=4000),
 status text not null default 'todo' check(status in ('todo','in_progress','in_review','done')),
 type text not null default '' check(length(type)<=40),
 priority text not null default 'medium' check(priority in ('low','medium','high')),
 start_at date,
 due_at date,
 position double precision not null default extract(epoch from now()),
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(start_at is null or due_at is null or start_at<=due_at));
create index zarn_tasks_project on public.zarn_tasks(project_id,status);

create table public.zarn_task_assignees (
 task_id uuid not null references public.zarn_tasks(id) on delete cascade,
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 project_id uuid not null references public.zarn_projects(id) on delete cascade,
 primary key(task_id,user_id));
create index zarn_task_assignees_user on public.zarn_task_assignees(user_id);

-- Team members (not guests) who belong to a project, and admins, can work in it.
create function public.zarn_in_project(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member()
  and coalesce((select m.account_type from public.zarn_members m where m.user_id=(select auth.uid())),'guest')='member'
  and (exists(select 1 from public.zarn_project_members pm where pm.project_id=p and pm.user_id=(select auth.uid())) or public.zarn_is_admin()) $$;
create function public.zarn_project_owner(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.zarn_in_project(p) and (public.zarn_is_admin() or exists(select 1 from public.zarn_projects pr where pr.id=p and pr.created_by=(select auth.uid()))) $$;

create function public.zarn_project_creator() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.created_by is not null then insert into public.zarn_project_members(project_id,user_id,added_by) values(new.id,new.created_by,new.created_by) on conflict do nothing; end if;
 return null;
end $$;
create trigger zarn_project_creator after insert on public.zarn_projects for each row execute function public.zarn_project_creator();

alter table public.zarn_projects enable row level security;
alter table public.zarn_project_members enable row level security;
alter table public.zarn_tasks enable row level security;
alter table public.zarn_task_assignees enable row level security;

create policy proj_read on public.zarn_projects for select to authenticated using(created_by=(select auth.uid()) or public.zarn_in_project(id));
create policy proj_add on public.zarn_projects for insert to authenticated with check(created_by=(select auth.uid()) and public.is_zarn_member()
 and coalesce((select m.account_type from public.zarn_members m where m.user_id=(select auth.uid())),'guest')='member');
create policy proj_edit on public.zarn_projects for update to authenticated using(public.zarn_project_owner(id)) with check(public.zarn_project_owner(id));
create policy proj_remove on public.zarn_projects for delete to authenticated using(public.zarn_project_owner(id));

create policy pm_read on public.zarn_project_members for select to authenticated using(public.zarn_in_project(project_id));
create policy pm_add on public.zarn_project_members for insert to authenticated with check(public.zarn_in_project(project_id)
 and exists(select 1 from public.zarn_members m where m.user_id=zarn_project_members.user_id and m.deactivated_at is null and m.account_type='member'));
create policy pm_remove on public.zarn_project_members for delete to authenticated using(user_id=(select auth.uid()) or public.zarn_project_owner(project_id));

create policy task_read on public.zarn_tasks for select to authenticated using(public.zarn_in_project(project_id));
create policy task_add on public.zarn_tasks for insert to authenticated with check(public.zarn_in_project(project_id) and created_by=(select auth.uid()));
create policy task_edit on public.zarn_tasks for update to authenticated using(public.zarn_in_project(project_id)) with check(public.zarn_in_project(project_id));
create policy task_remove on public.zarn_tasks for delete to authenticated using(public.zarn_in_project(project_id));

create policy ta_read on public.zarn_task_assignees for select to authenticated using(public.zarn_in_project(project_id));
create policy ta_add on public.zarn_task_assignees for insert to authenticated with check(public.zarn_in_project(project_id)
 and exists(select 1 from public.zarn_project_members pm where pm.project_id=zarn_task_assignees.project_id and pm.user_id=zarn_task_assignees.user_id)
 and exists(select 1 from public.zarn_tasks t where t.id=zarn_task_assignees.task_id and t.project_id=zarn_task_assignees.project_id));
create policy ta_remove on public.zarn_task_assignees for delete to authenticated using(public.zarn_in_project(project_id));

-- Demo project with sample tasks across every status, assigned around the team, so the views have something to show.
do $$
declare owner uuid; p uuid; t uuid; ms uuid[]; n int; i int:=0; r record;
begin
 select array_agg(user_id order by joined_at) into ms from public.zarn_members where joined_at is not null and deactivated_at is null and account_type='member';
 n:=coalesce(array_length(ms,1),0);
 if n=0 then return; end if;
 owner:=ms[1];
 insert into public.zarn_projects(name,description,created_by) values('Website revamp (demo)','A sample project to try the list, board and timeline views. Delete it any time.',owner) returning id into p;
 insert into public.zarn_project_members(project_id,user_id,added_by) select p,u,owner from unnest(ms) u on conflict do nothing;
 for r in select * from (values
  ('Homepage copy review','Read through the homepage copy and flag anything unclear or off-brand.','todo','Marketing','medium',2,6),
  ('Collect brand assets','Gather logos, colours and fonts from the brand folder in one place.','todo','Design','low',1,4),
  ('Plan launch checklist','List everything that must be ready before the site goes live.','todo','Marketing','high',5,10),
  ('Design new hero section','Headline, subheading and a call to action above the fold.','in_progress','Design','high',-3,3),
  ('Build pricing page','Three plans with a comparison table.','in_progress','Development','medium',-2,5),
  ('Set up analytics events','Track sign-ups and button clicks.','in_progress','Development','low',-1,4),
  ('Mobile navigation menu','Slide-out menu with the main links.','in_review','Development','medium',-6,-1),
  ('Case study layouts','Two layouts for the Work page.','in_review','Design','high',-5,1),
  ('Kickoff and goals','Agree the goals and who owns what.','done','Research','medium',-14,-12),
  ('Competitor audit','Look at five competitor sites and note what works.','done','Research','low',-12,-7),
  ('Sitemap and structure','Pages, navigation and how they connect.','done','Design','medium',-10,-6),
  ('Domain and hosting setup','Point the domain and set up hosting.','done','Development','low',-9,-8)
 ) as v(title,descr,status,type,prio,s,d) loop
  i:=i+1;
  insert into public.zarn_tasks(project_id,title,description,status,type,priority,start_at,due_at,position,created_by)
   values(p,r.title,r.descr,r.status,r.type,r.prio,current_date+r.s,current_date+r.d,extract(epoch from now())+i,owner) returning id into t;
  insert into public.zarn_task_assignees(task_id,user_id,project_id) values(t,ms[1+(i%n)],p);
  if n>1 and i%3=0 then insert into public.zarn_task_assignees(task_id,user_id,project_id) values(t,ms[1+((i+1)%n)],p) on conflict do nothing; end if;
 end loop;
end $$;
