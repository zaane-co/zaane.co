-- Leads CRM: deal fields + pipeline position on leads, an activity timeline, and follow-up tasks.
begin;
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check(status in ('new','contacted','qualified','proposal','won','lost'));
alter table public.leads
 add column phone text not null default '',
 add column website text not null default '',
 add column source text not null default 'website' check(source in ('website','partnership','referral','outbound','social','event','other')),
 add column deal_value numeric(14,2) check(deal_value is null or deal_value>=0),
 add column currency text not null default 'NGN' check(currency in ('NGN','USD','GBP','EUR')),
 add column owner_id uuid references public.users on delete set null,
 add column tags text[] not null default '{}',
 add column lost_reason text not null default '',
 -- Board order inside a stage: lower sorts first, so new leads default to the top.
 add column position double precision not null default -extract(epoch from now()),
 add column stage_changed_at timestamptz not null default now(),
 add column last_activity_at timestamptz not null default now(),
 add column updated_at timestamptz not null default now();
update public.leads set position=-extract(epoch from created_at),stage_changed_at=created_at,last_activity_at=created_at,source=case when service_interested='Brand Partnerships' then 'partnership' else 'website' end;
create trigger lead_updated before update on public.leads for each row execute function public.touch_updated();

create table public.lead_activities (id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads on delete cascade, kind text not null check(kind in ('note','call','meeting','email','stage','task')), body text not null default '' check(length(body)<=20000), meta jsonb not null default '{}', author_id uuid references public.users on delete set null, created_at timestamptz not null default now());
create index lead_activities_lead on public.lead_activities(lead_id,created_at desc);
create table public.lead_tasks (id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads on delete cascade, title text not null check(length(trim(title)) between 1 and 300), due_at timestamptz, done_at timestamptz, assignee_id uuid references public.users on delete set null, created_by uuid references public.users on delete set null, created_at timestamptz not null default now());
create index lead_tasks_lead on public.lead_tasks(lead_id);
create index lead_tasks_open on public.lead_tasks(due_at) where done_at is null;
create index leads_stage on public.leads(status,position);

do $$ declare t text; begin
foreach t in array array['lead_activities','lead_tasks'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy management on public.%I for all to authenticated using(public.staff_role() in (''super_admin'',''admin'')) with check(public.staff_role() in (''super_admin'',''admin''))',t);
end loop; end $$;

-- Every stage change lands on the timeline, whoever or whatever made it (board drag, bulk action, detail page).
create function public.lead_stage_log() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status is distinct from old.status then
  new.stage_changed_at=now();new.last_activity_at=now();
  insert into public.lead_activities(lead_id,kind,meta,author_id) values(new.id,'stage',jsonb_build_object('from',old.status,'to',new.status),auth.uid());
 end if;
 return new;
end $$;
create trigger lead_stage before update of status on public.leads for each row execute function public.lead_stage_log();
-- Stage rows are skipped: the trigger above already bumps last_activity_at on the row being updated.
create function public.lead_touch_activity() returns trigger language plpgsql security definer set search_path = '' as $$
begin update public.leads set last_activity_at=now() where id=new.lead_id; return new; end $$;
create trigger lead_activity_touch after insert on public.lead_activities for each row when (new.kind<>'stage') execute function public.lead_touch_activity();
commit;
