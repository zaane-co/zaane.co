-- Shared files per lead/client (stored privately on Cloudflare R2). Staff with CRM access see them in the admin;
-- the client's ZARN team sees them in the client space (served through /api/zarn/clients/files after a team check).
create table public.lead_files (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads on delete cascade,
 key text not null unique check(key like 'private/leads/%'),
 name text not null check(length(name) between 1 and 200),
 size bigint not null check(size>=0),
 type text not null default 'application/octet-stream',
 uploaded_by uuid references auth.users on delete set null,
 created_at timestamptz not null default now());
create index lead_files_lead on public.lead_files(lead_id,created_at desc);
alter table public.lead_files enable row level security;
create policy staff_manage on public.lead_files for all to authenticated using(public.staff_role() in ('super_admin','admin','sales')) with check(public.staff_role() in ('super_admin','admin','sales'));
create policy finance_read on public.lead_files for select to authenticated using(public.staff_role()='finance');
