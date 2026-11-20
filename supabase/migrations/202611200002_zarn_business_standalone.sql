-- ZARN Business stands on its own: its own contacts (leads and customers), invoices, payments and money book.
-- Nothing here points at Clients (public.leads). Reached only through the server after a ZARN admin check.

-- Undo the client hooks added in 202611200001.
alter table public.zarn_client_receipts drop column if exists bill_id;
alter table public.zarn_client_receipts drop column if exists category;
alter table public.zarn_client_receipts drop column if exists vendor;
drop index if exists public.zarn_client_receipts_day;
do $$ begin
 if not exists(select 1 from public.zarn_client_receipts where lead_id is null) then
  alter table public.zarn_client_receipts alter column lead_id set not null;
 end if;
end $$;
alter table public.zarn_bills drop column if exists lead_id;

create table public.zarn_biz_contacts (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 160),
 email text not null default '' check (length(email)<=254),
 company text not null default '' check (length(company)<=200),
 phone text not null default '' check (length(phone)<=40),
 stage text not null default 'new' check (stage in ('new','contacted','proposal','won','lost')),
 source text not null default 'manual' check (source in ('manual','form','referral','social','website','event','other')),
 value numeric(14,2) check (value is null or value>=0),
 currency text not null default 'NGN' check (length(currency) between 3 and 4),
 note text not null default '' check (length(note)<=5000),
 form_id uuid references public.zarn_docs(id) on delete set null,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index zarn_biz_contacts_new on public.zarn_biz_contacts(created_at desc);

create sequence public.zarn_biz_invoice_seq;
create table public.zarn_biz_invoices (
 id uuid primary key default gen_random_uuid(),
 contact_id uuid not null references public.zarn_biz_contacts(id) on delete restrict,
 number text not null unique default 'ZB-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.zarn_biz_invoice_seq')::text,4,'0'),
 status text not null default 'draft' check (status in ('draft','sent','paid','void')),
 currency text not null default 'NGN' check (length(currency) between 3 and 4),
 issue_date date not null default current_date,
 due_date date not null default current_date+14,
 items jsonb not null default '[]' check (jsonb_typeof(items)='array'),
 tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
 discount numeric(14,2) not null default 0 check (discount>=0),
 subtotal numeric(14,2) not null default 0,
 total numeric(14,2) not null default 0,
 amount_paid numeric(14,2) not null default 0,
 notes text not null default '' check (length(notes)<=5000),
 bank_account_id uuid references public.bank_accounts(id) on delete set null,
 public_token uuid not null unique default gen_random_uuid(),
 sent_at timestamptz, paid_at timestamptz,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.zarn_biz_payments (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references public.zarn_biz_invoices(id) on delete cascade,
 amount numeric(14,2) not null check (amount>0),
 paid_on date not null default current_date,
 method text not null default 'Bank transfer' check (length(method)<=40),
 note text not null default '' check (length(note)<=500),
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
create index zarn_biz_payments_day on public.zarn_biz_payments(paid_on desc);

create table public.zarn_biz_entries (
 id uuid primary key default gen_random_uuid(),
 direction text not null check (direction in ('in','out')),
 title text not null check (length(trim(title)) between 1 and 160),
 amount numeric(14,2) not null check (amount>0),
 currency text not null default 'NGN' check (length(currency) between 3 and 4),
 paid_on date not null default current_date,
 category text not null default '' check (length(category)<=60),
 vendor text not null default '' check (length(vendor)<=160),
 note text not null default '' check (length(note)<=2000),
 contact_id uuid references public.zarn_biz_contacts(id) on delete set null,
 bill_id uuid references public.zarn_bills(id) on delete set null,
 file_key text not null default '', file_name text not null default '', file_size int not null default 0, file_type text not null default '',
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
create index zarn_biz_entries_day on public.zarn_biz_entries(paid_on desc);

do $$ declare t text; begin
 foreach t in array array['zarn_biz_contacts','zarn_biz_invoices','zarn_biz_payments','zarn_biz_entries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
revoke all on sequence public.zarn_biz_invoice_seq from anon, authenticated;
