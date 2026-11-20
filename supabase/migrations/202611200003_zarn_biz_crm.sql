-- ZARN Business leads: contacts (full details, importable from sheets), companies (made automatically from a
-- contact's company name), deals on a board, and customers (active or archived). Still separate from Clients.

create table public.zarn_biz_companies (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 200),
 website text not null default '' check (length(website)<=300),
 industry text not null default '' check (length(industry)<=120),
 email text not null default '' check (length(email)<=254),
 phone text not null default '' check (length(phone)<=40),
 address text not null default '' check (length(address)<=500),
 note text not null default '' check (length(note)<=5000),
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
-- One company per name, whatever the capitals or spacing.
create unique index zarn_biz_companies_name on public.zarn_biz_companies(lower(trim(name)));

-- Stage and value move to deals. A contact is a lead until a deal is won, then a customer.
alter table public.zarn_biz_contacts drop column stage, drop column value, drop column currency;
alter table public.zarn_biz_contacts
 add column company_id uuid references public.zarn_biz_companies(id) on delete set null,
 add column job_title text not null default '' check (length(job_title)<=120),
 add column website text not null default '' check (length(website)<=300),
 add column social text not null default '' check (length(social)<=300),
 add column address text not null default '' check (length(address)<=500),
 add column city text not null default '' check (length(city)<=120),
 add column country text not null default '' check (length(country)<=120),
 add column tags text[] not null default '{}',
 add column customer boolean not null default false,
 add column customer_since timestamptz,
 add column archived_at timestamptz;
alter table public.zarn_biz_contacts drop constraint zarn_biz_contacts_source_check;
alter table public.zarn_biz_contacts add constraint zarn_biz_contacts_source_check check (source in ('manual','form','import','referral','social','website','event','other'));
create index zarn_biz_contacts_company on public.zarn_biz_contacts(company_id);
create index zarn_biz_contacts_email on public.zarn_biz_contacts(lower(email)) where email<>'';

create table public.zarn_biz_deals (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 1 and 200),
 contact_id uuid references public.zarn_biz_contacts(id) on delete set null,
 company_id uuid references public.zarn_biz_companies(id) on delete set null,
 stage text not null default 'new' check (stage in ('new','contacted','proposal','negotiation','won','lost')),
 position double precision not null default 0,
 value numeric(14,2) check (value is null or value>=0),
 currency text not null default 'NGN' check (length(currency) between 3 and 4),
 close_on date,
 note text not null default '' check (length(note)<=5000),
 won_at timestamptz,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index zarn_biz_deals_stage on public.zarn_biz_deals(stage,position);

alter table public.zarn_biz_companies enable row level security;
alter table public.zarn_biz_deals enable row level security;
revoke all on public.zarn_biz_companies from anon, authenticated;
revoke all on public.zarn_biz_deals from anon, authenticated;
