-- ZARN Business: the money book, receipts and bills. Admin-only, so these tables are reached only through the
-- server (service role) after a ZARN admin check, like client receipts. No policies on purpose.

-- Receipts and money entries now cover the whole business, not only clients: lead_id is optional.
alter table public.zarn_client_receipts alter column lead_id drop not null;
alter table public.zarn_client_receipts add column category text not null default '' check (length(category)<=60);
alter table public.zarn_client_receipts add column vendor text not null default '' check (length(vendor)<=160);
create index zarn_client_receipts_day on public.zarn_client_receipts(paid_on desc);

-- Bills we pay: one-off or repeating. Paying one logs a money-out entry and moves a repeating bill to its next date.
create table public.zarn_bills (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 1 and 160),
 vendor text not null default '' check (length(vendor)<=160),
 amount numeric(14,2) not null check (amount>0),
 currency text not null default 'NGN' check (length(currency) between 3 and 4),
 category text not null default '' check (length(category)<=60),
 due_on date,
 repeat text not null default 'none' check (repeat in ('none','weekly','monthly','yearly')),
 start_on date,
 lead_id uuid references public.leads(id) on delete set null,
 note text not null default '' check (length(note)<=2000),
 reminded_for date,
 last_paid_on date,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
create index zarn_bills_due on public.zarn_bills(due_on);
alter table public.zarn_client_receipts add column bill_id uuid references public.zarn_bills(id) on delete set null;
alter table public.zarn_bills enable row level security;
revoke all on public.zarn_bills from anon, authenticated;
