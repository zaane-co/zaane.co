-- Zoho Mail: each person connects their own mailbox. Tokens are encrypted with VAULT_KEY and only the server reads this table.
create table public.zarn_mail_accounts (
 user_id uuid primary key references public.zarn_members on delete cascade,
 zoho_account_id text not null,
 email text not null,
 display_name text not null default '',
 accounts_server text not null,
 mail_host text not null,
 refresh_token text not null,
 access_token text,
 access_expires_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.zarn_mail_accounts enable row level security;
revoke all on public.zarn_mail_accounts from anon, authenticated;
