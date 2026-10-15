-- Company bank accounts printed on invoices. Each invoice points at the account clients should pay into.
begin;
create table public.bank_accounts (
 id uuid primary key default gen_random_uuid(),
 currency text not null default '' check(length(currency)<=8),
 bank text not null check(length(trim(bank)) between 1 and 120),
 account_name text not null default '' check(length(account_name)<=160),
 account_number text not null check(length(trim(account_number)) between 1 and 60),
 extra text not null default '' check(length(extra)<=500),
 is_default boolean not null default false,
 created_at timestamptz not null default now());
alter table public.bank_accounts enable row level security;
create policy staff_manage on public.bank_accounts for all to authenticated using(public.staff_role() in ('super_admin','admin','finance')) with check(public.staff_role() in ('super_admin','admin','finance'));
create policy sales_read on public.bank_accounts for select to authenticated using(public.staff_role()='sales');
alter table public.invoices add column bank_account_id uuid references public.bank_accounts on delete set null;
commit;
