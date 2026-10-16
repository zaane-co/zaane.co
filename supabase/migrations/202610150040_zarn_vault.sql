-- Client vault: logins kept encrypted (the password is encrypted by the server before it is stored).
-- Only the server reads or writes these tables; there are deliberately no browser-facing policies.
create table public.zarn_vault_items (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 label text not null check (length(trim(label)) between 1 and 120),
 url text not null default '' check (length(url) <= 500),
 username text not null default '' check (length(username) <= 300),
 secret_enc text not null default '',
 note text not null default '' check (length(note) <= 2000),
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index zarn_vault_items_lead_idx on public.zarn_vault_items(lead_id);
create table public.zarn_vault_log (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 item_id uuid,
 item_label text not null default '',
 user_id uuid references public.zarn_members(user_id) on delete set null,
 action text not null check (action in ('create','update','delete','reveal','copy')),
 at timestamptz not null default now()
);
create index zarn_vault_log_lead_idx on public.zarn_vault_log(lead_id,at desc);
alter table public.zarn_vault_items enable row level security;
alter table public.zarn_vault_log enable row level security;
