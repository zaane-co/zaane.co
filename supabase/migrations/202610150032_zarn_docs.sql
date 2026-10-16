-- ZARN documents: written in the app, shared by permission, optionally via a password-protected link.
create table public.zarn_docs (
 id uuid primary key default gen_random_uuid(),
 title text not null default 'Untitled' check (length(title) <= 200),
 content text not null default '' check (length(content) <= 400000),
 owner_id uuid not null references public.zarn_members(user_id) on delete cascade,
 visibility text not null default 'private' check (visibility in ('private','team')),
 team_role text not null default 'view' check (team_role in ('view','edit')),
 lead_id uuid references public.leads(id) on delete set null,
 updated_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index zarn_docs_owner_idx on public.zarn_docs(owner_id);
create index zarn_docs_lead_idx on public.zarn_docs(lead_id);

create table public.zarn_doc_members (
 doc_id uuid not null references public.zarn_docs(id) on delete cascade,
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 role text not null default 'view' check (role in ('view','edit')),
 primary key (doc_id,user_id)
);

create table public.zarn_doc_links (
 id uuid primary key default gen_random_uuid(),
 doc_id uuid not null references public.zarn_docs(id) on delete cascade,
 token text not null unique,
 password_hash text,
 expires_at timestamptz,
 views int not null default 0,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index zarn_doc_links_doc_idx on public.zarn_doc_links(doc_id);

-- The caller's best access to a document: owner, edit, view or null. Owner, people it is shared with,
-- everyone on the team (if shared with the team) and the team of a linked client all count.
create function public.zarn_doc_role(d uuid) returns text language sql stable security definer set search_path = '' as $$
 with r as (
  select 'owner'::text as role where public.is_zarn_member() and exists(select 1 from public.zarn_docs x where x.id=d and x.owner_id=(select auth.uid()))
  union all select m.role from public.zarn_doc_members m where public.is_zarn_member() and m.doc_id=d and m.user_id=(select auth.uid())
  union all select x.team_role from public.zarn_docs x where x.id=d and x.visibility='team' and public.is_zarn_member() and not public.zarn_is_guest()
  union all select x.team_role from public.zarn_docs x where x.id=d and x.lead_id is not null and public.is_zarn_member()
   and exists(select 1 from public.zarn_channels c where c.lead_id=x.lead_id and c.kind='client' and public.zarn_in_channel(c.id))
 )
 select case when exists(select 1 from r where role='owner') then 'owner' when exists(select 1 from r where role='edit') then 'edit' when exists(select 1 from r) then 'view' end $$;

create function public.zarn_docs_touch() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger zarn_docs_touch before update on public.zarn_docs for each row execute function public.zarn_docs_touch();

alter table public.zarn_docs enable row level security;
alter table public.zarn_doc_members enable row level security;
alter table public.zarn_doc_links enable row level security;
create policy read_docs on public.zarn_docs for select to authenticated using (public.zarn_doc_role(id) is not null);
create policy create_docs on public.zarn_docs for insert to authenticated with check (owner_id=(select auth.uid()) and public.is_zarn_member() and not public.zarn_is_guest());
create policy edit_docs on public.zarn_docs for update to authenticated using (public.zarn_doc_role(id) in ('owner','edit')) with check (public.zarn_doc_role(id) in ('owner','edit'));
create policy delete_docs on public.zarn_docs for delete to authenticated using (owner_id=(select auth.uid()));
-- Sharing settings, people and links are changed only by the server (owner checks live there).
revoke update on public.zarn_docs from authenticated;
grant update(title,content,updated_by) on public.zarn_docs to authenticated;
create policy read_doc_members on public.zarn_doc_members for select to authenticated using (public.zarn_doc_role(doc_id) is not null);
