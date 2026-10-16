-- ZARN Activity: company events (new teammates, closed clients, completed projects), written by triggers.
-- And richer to-dos: status, description, priority and a start date.
alter table public.leads add column if not exists project_completed_at timestamptz;

create table public.zarn_events (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('member_joined','client_won','client_lost','project_completed')),
 lead_id uuid references public.leads(id) on delete set null,
 user_id uuid references public.zarn_members(user_id) on delete set null,
 title text not null default '',
 detail text not null default '',
 meta jsonb not null default '{}',
 created_at timestamptz not null default now());
create index zarn_events_recent on public.zarn_events(created_at desc);
alter table public.zarn_events enable row level security;
-- Everyone on the team sees new teammates; client and project news is for people with CRM access (and admins).
create policy events_read on public.zarn_events for select to authenticated using(
 public.is_zarn_member() and (
  (kind='member_joined' and coalesce((select account_type from public.zarn_members where user_id=(select auth.uid())),'guest')='member')
  or (kind<>'member_joined' and (public.zarn_can_crm() or public.zarn_is_admin()))));

create function public.zarn_event_member() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.joined_at is not null and (tg_op='INSERT' or old.joined_at is null) then
  insert into public.zarn_events(kind,user_id,title,detail) values('member_joined',new.user_id,new.display_name,new.title);
 end if;
 return null;
end $$;
create trigger zarn_event_member after insert or update of joined_at on public.zarn_members for each row execute function public.zarn_event_member();

create function public.zarn_event_lead() returns trigger language plpgsql security definer set search_path = '' as $$
declare k text; nm text;
begin
 nm:=coalesce(nullif(trim(new.company),''),new.name);
 if new.status is distinct from old.status then
  select kind into k from public.pipeline_stages where key=new.status;
  if k in ('won','lost') then
   insert into public.zarn_events(kind,lead_id,title,detail,meta) values(case k when 'won' then 'client_won' else 'client_lost' end,new.id,nm,coalesce(new.service_interested,''),
    jsonb_build_object('deal_value',new.deal_value,'currency',new.currency));
  end if;
 end if;
 if new.project_completed_at is not null and old.project_completed_at is null then
  insert into public.zarn_events(kind,lead_id,title,detail) values('project_completed',new.id,nm,coalesce(nullif(new.service_interested,''),''));
 end if;
 return null;
end $$;
create trigger zarn_event_lead after update of status,project_completed_at on public.leads for each row execute function public.zarn_event_lead();

-- Teammates who already joined show up in the feed too.
insert into public.zarn_events(kind,user_id,title,detail,created_at)
 select 'member_joined',user_id,display_name,title,joined_at from public.zarn_members where joined_at is not null and deactivated_at is null;

alter table public.zarn_todos
 add column status text not null default 'todo' check(status in ('todo','in_progress','done')),
 add column description text not null default '' check(length(description)<=2000),
 add column priority text not null default 'medium' check(priority in ('low','medium','high')),
 add column start_at date;
update public.zarn_todos set status='done' where done_at is not null;
grant update(status,description,priority,start_at) on public.zarn_todos to authenticated;
