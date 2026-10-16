-- Vault: API keys, environment files and secret files as well as logins, plus private links for handing items to a client.
alter table public.zarn_vault_items
 add column kind text not null default 'login' check (kind in ('login','api','env','file')),
 add column file_key text not null default '',
 add column file_name text not null default '',
 add column file_size int not null default 0;
alter table public.zarn_vault_log drop constraint zarn_vault_log_action_check;
alter table public.zarn_vault_log add constraint zarn_vault_log_action_check check (action in ('create','update','delete','reveal','copy','download','share_create','share_revoke','share_open','share_reveal','share_download'));

create table public.zarn_vault_shares (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 token text not null unique,
 label text not null default '',
 password_hash text not null,
 expires_at timestamptz not null,
 view_once boolean not null default false,
 opened_at timestamptz,
 revoked_at timestamptz,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
create table public.zarn_vault_share_items (
 share_id uuid not null references public.zarn_vault_shares(id) on delete cascade,
 item_id uuid not null references public.zarn_vault_items(id) on delete cascade,
 primary key (share_id,item_id)
);
alter table public.zarn_vault_shares enable row level security;
alter table public.zarn_vault_share_items enable row level security;
