-- Client care: reminders, recurring deliverables and payment receipts inside a client's space.
-- Everything goes through the server (/api/zarn/care), which checks client access, so these tables have RLS on and no policies.
create table public.zarn_client_reminders (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 160),
 note text not null default '' check (length(note)<=2000),
 repeat text not null default 'none' check (repeat in ('none','daily','weekly','monthly','yearly','every_n')),
 every_n int not null default 1 check (every_n between 1 and 365),
 start_on date not null,
 next_on date,
 audience text not null default 'team' check (audience in ('team','me')),
 email boolean not null default true,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index zarn_client_reminders_lead on public.zarn_client_reminders(lead_id);
create index zarn_client_reminders_next on public.zarn_client_reminders(next_on) where next_on is not null;

create table public.zarn_client_deliverables (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 160),
 note text not null default '' check (length(note)<=2000),
 repeat text not null default 'monthly' check (repeat in ('none','weekly','monthly','every_n','adhoc')),
 every_n int not null default 1 check (every_n between 1 and 365),
 start_on date,
 next_on date,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index zarn_client_deliverables_lead on public.zarn_client_deliverables(lead_id);
create index zarn_client_deliverables_next on public.zarn_client_deliverables(next_on) where next_on is not null;

create table public.zarn_deliverable_log (
 id uuid primary key default gen_random_uuid(),
 deliverable_id uuid not null references public.zarn_client_deliverables(id) on delete cascade,
 lead_id uuid not null references public.leads(id) on delete cascade,
 due_on date,
 delivered_on date not null default current_date,
 note text not null default '' check (length(note)<=2000),
 file_key text not null default '',
 file_name text not null default '',
 file_size int not null default 0,
 file_type text not null default '',
 delivered_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
create index zarn_deliverable_log_item on public.zarn_deliverable_log(deliverable_id,delivered_on desc);

-- Money, so admin-only. direction: 'in' = the client paid us, 'out' = we paid something for the client.
create table public.zarn_client_receipts (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 direction text not null check (direction in ('in','out')),
 title text not null check (length(trim(title)) between 1 and 160),
 amount numeric(14,2) not null check (amount>0),
 currency text not null default 'NGN' check (length(currency) between 3 and 4),
 paid_on date not null default current_date,
 invoice_id uuid references public.invoices(id) on delete set null,
 note text not null default '' check (length(note)<=2000),
 file_key text not null default '',
 file_name text not null default '',
 file_size int not null default 0,
 file_type text not null default '',
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
create index zarn_client_receipts_lead on public.zarn_client_receipts(lead_id,paid_on desc);

-- One alert per reminder or deliverable per due date; the unique key stops a second run from sending it twice.
create table public.zarn_care_alerts (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 kind text not null check (kind in ('reminder','deliverable')),
 source_id uuid not null,
 due_on date not null,
 title text not null,
 recipients uuid[] not null default '{}',
 created_at timestamptz not null default now(),
 unique (source_id,due_on)
);
create index zarn_care_alerts_recipients on public.zarn_care_alerts using gin(recipients);

create table public.zarn_care_alert_seen (
 alert_id uuid not null references public.zarn_care_alerts(id) on delete cascade,
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 seen_at timestamptz not null default now(),
 primary key (alert_id,user_id)
);

alter table public.zarn_client_reminders enable row level security;
alter table public.zarn_client_deliverables enable row level security;
alter table public.zarn_deliverable_log enable row level security;
alter table public.zarn_client_receipts enable row level security;
alter table public.zarn_care_alerts enable row level security;
alter table public.zarn_care_alert_seen enable row level security;
