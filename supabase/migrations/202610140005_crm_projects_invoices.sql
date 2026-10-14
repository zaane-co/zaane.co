-- CRM: project scope + multiple categories per lead, a client materials checklist, and invoices with payments.
begin;
alter table public.leads
 add column project_description text not null default '' check(length(project_description)<=50000),
 add column categories text[] not null default '{}';
create table public.lead_categories (id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name)) between 1 and 60), created_at timestamptz not null default now());
insert into public.lead_categories(name) values ('Branding'),('UI/UX Design'),('Web Development'),('Mobile App'),('MVP'),('E-commerce'),('Brand Partnership');

-- Things the client owes us (logo files, copy, logins). A row can carry a link (Drive, WeTransfer) and/or an uploaded file kept in R2 under private/.
create table public.lead_materials (id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads on delete cascade, title text not null check(length(trim(title)) between 1 and 200), note text not null default '' check(length(note)<=2000), link text not null default '', file_key text, file_name text not null default '', received_at timestamptz, position integer not null default 0, created_at timestamptz not null default now());
create index lead_materials_lead on public.lead_materials(lead_id,position);

create sequence public.invoice_seq;
create table public.invoices (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads on delete restrict,
 number text not null unique default 'ZA-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.invoice_seq')::text,4,'0'),
 status text not null default 'draft' check(status in ('draft','sent','paid','void')),
 currency text not null default 'NGN' check(currency in ('NGN','USD','GBP','EUR')),
 issue_date date not null default current_date,
 due_date date not null default current_date+14,
 items jsonb not null default '[]' check(jsonb_typeof(items)='array'),
 tax_rate numeric(5,2) not null default 0 check(tax_rate between 0 and 100),
 discount numeric(14,2) not null default 0 check(discount>=0),
 subtotal numeric(14,2) not null default 0,
 total numeric(14,2) not null default 0,
 amount_paid numeric(14,2) not null default 0,
 notes text not null default '' check(length(notes)<=5000),
 -- Unguessable id for the client-facing /invoice/<token> page.
 public_token uuid not null unique default gen_random_uuid(),
 sent_at timestamptz, paid_at timestamptz,
 created_by uuid references public.users on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index invoices_lead on public.invoices(lead_id);
create index invoices_status on public.invoices(status,due_date);
create trigger invoice_updated before update on public.invoices for each row execute function public.touch_updated();
create table public.invoice_payments (id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices on delete cascade, amount numeric(14,2) not null check(amount>0), paid_on date not null default current_date, method text not null default 'Bank transfer', note text not null default '', created_by uuid references public.users on delete set null, created_at timestamptz not null default now());
create index invoice_payments_invoice on public.invoice_payments(invoice_id);

-- amount_paid always equals the sum of payments; full payment marks the invoice paid, removing a payment reopens it.
create function public.invoice_paid_sync() returns trigger language plpgsql security definer set search_path = '' as $$
declare inv uuid := coalesce(new.invoice_id,old.invoice_id); paid numeric;
begin
 select coalesce(sum(amount),0) into paid from public.invoice_payments where invoice_id=inv;
 update public.invoices set amount_paid=paid,
  status=case when status='void' then status when paid>=total and total>0 then 'paid' when status='paid' then 'sent' else status end,
  paid_at=case when paid>=total and total>0 then coalesce(paid_at,now()) else null end
 where id=inv;
 return null;
end $$;
create trigger invoice_payment_sync after insert or update or delete on public.invoice_payments for each row execute function public.invoice_paid_sync();

do $$ declare t text; begin
foreach t in array array['lead_categories','lead_materials','invoices','invoice_payments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy management on public.%I for all to authenticated using(public.staff_role() in (''super_admin'',''admin'')) with check(public.staff_role() in (''super_admin'',''admin''))',t);
end loop; end $$;
commit;
