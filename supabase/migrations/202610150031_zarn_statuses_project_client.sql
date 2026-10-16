-- Custom task statuses (extra board columns) and linking a project to a client.
create table public.zarn_task_statuses (
 key text primary key check (key ~ '^[a-z0-9_]{1,48}$'),
 label text not null check (length(trim(label)) between 1 and 30),
 color text not null default '#71717a' check (color ~ '^#[0-9a-fA-F]{6}$'),
 position int not null default 0,
 builtin boolean not null default false,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
insert into public.zarn_task_statuses(key,label,color,position,builtin) values
 ('todo','To-do','#71717a',0,true),('in_progress','On progress','#2563eb',1,true),('in_review','In review','#d97706',2,true),('done','Done','#16a34a',3,true);
alter table public.zarn_task_statuses enable row level security;
create policy read_all on public.zarn_task_statuses for select to authenticated using(public.is_zarn_member());
-- Writes go through the server (add and delete move tasks safely).
alter table public.zarn_tasks drop constraint zarn_tasks_status_check;
alter table public.zarn_tasks add constraint zarn_tasks_status_fk foreign key (status) references public.zarn_task_statuses(key) on update cascade;
alter publication supabase_realtime add table public.zarn_task_statuses;

alter table public.zarn_projects add column lead_id uuid references public.leads(id) on delete set null;
create index zarn_projects_lead_idx on public.zarn_projects(lead_id);
