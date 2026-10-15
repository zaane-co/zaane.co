-- Newsletter: subscribers can opt out, and staff can send campaigns to everyone still subscribed.
alter table public.subscribers add column if not exists unsubscribed_at timestamptz;
alter table public.subscribers add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists subscribers_unsubscribe_token_key on public.subscribers(unsubscribe_token);

create table if not exists public.newsletter_campaigns (
 id uuid primary key default gen_random_uuid(),
 subject text not null default '',
 body text not null default '',
 status text not null default 'draft' check (status in ('draft','sending','sent')),
 recipient_count int not null default 0,
 sent_count int not null default 0,
 failed_count int not null default 0,
 sent_at timestamptz,
 created_by uuid references public.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.newsletter_campaigns enable row level security;
create policy management on public.newsletter_campaigns for all to authenticated
 using(public.staff_role() in ('super_admin','admin','sales')) with check(public.staff_role() in ('super_admin','admin','sales'));
