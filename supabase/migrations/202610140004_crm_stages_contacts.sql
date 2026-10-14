-- CRM: admin-managed pipeline stages (instead of a fixed list) and manually added contacts.
begin;
create table public.pipeline_stages (key text primary key check(key ~ '^[a-z0-9_]{1,40}$'), label text not null check(length(trim(label)) between 1 and 40), color text not null check(color ~ '^#[0-9a-f]{6}$'), position integer not null default 0, kind text not null default 'open' check(kind in ('open','won','lost')), system boolean not null default false, created_at timestamptz not null default now());
-- New, Won and Lost are system stages: website briefs land in New, and Won/Lost drive the stats. They can be renamed and recoloured but not deleted.
insert into public.pipeline_stages(key,label,color,position,kind,system) values
 ('new','New','#f10c45',0,'open',true),('contacted','Contacted','#f59e0b',1,'open',false),('qualified','Qualified','#2563eb',2,'open',false),('proposal','Proposal','#7c3aed',3,'open',false),
 ('won','Won','#16a34a',1000,'won',true),('lost','Lost','#52525b',1001,'lost',true);
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_fkey foreign key(status) references public.pipeline_stages(key) on update cascade;
alter table public.pipeline_stages enable row level security;
create policy management on public.pipeline_stages for all to authenticated using(public.staff_role() in ('super_admin','admin')) with check(public.staff_role() in ('super_admin','admin'));

alter table public.contact_submissions
 add column phone text not null default '',
 add column company text not null default '',
 add column source text not null default 'website' check(source in ('website','manual'));
commit;
