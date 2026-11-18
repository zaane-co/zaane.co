-- Version history for sheets (and docs): saved copies of the content over time, some with names.
-- Anyone who can open the doc sees its history; editors add versions and name them; the owner can delete.
create table public.zarn_doc_versions (
 id uuid primary key default gen_random_uuid(),
 doc_id uuid not null references public.zarn_docs(id) on delete cascade,
 title text not null default '',
 content text not null,
 name text,
 created_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now());
create index zarn_doc_versions_doc on public.zarn_doc_versions(doc_id,created_at desc);
alter table public.zarn_doc_versions enable row level security;
create policy versions_read on public.zarn_doc_versions for select to authenticated
 using(public.zarn_doc_role(doc_id) is not null);
create policy versions_add on public.zarn_doc_versions for insert to authenticated
 with check(created_by=(select auth.uid()) and public.zarn_doc_role(doc_id) in ('owner','edit'));
create policy versions_name on public.zarn_doc_versions for update to authenticated
 using(public.zarn_doc_role(doc_id) in ('owner','edit')) with check(public.zarn_doc_role(doc_id) in ('owner','edit'));
create policy versions_drop on public.zarn_doc_versions for delete to authenticated
 using(public.zarn_doc_role(doc_id)='owner');

-- Keep the newest 200 unnamed versions per doc; named ones are kept until someone deletes them.
create or replace function private.zarn_versions_trim() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.zarn_doc_versions v where v.doc_id=new.doc_id and v.name is null and v.id in (
  select x.id from public.zarn_doc_versions x where x.doc_id=new.doc_id and x.name is null order by x.created_at desc offset 200);
 return null;
end $$;
create trigger zarn_versions_trim after insert on public.zarn_doc_versions for each row execute function private.zarn_versions_trim();
