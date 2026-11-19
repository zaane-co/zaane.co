-- Comments on documents, like Google Docs. The commented text carries a mark with the thread id (it lives in the
-- document itself, so it moves with edits); the conversation lives here. thread_id is the first comment's id.
create table public.zarn_doc_comments (
 id uuid primary key default gen_random_uuid(),
 doc_id uuid not null references public.zarn_docs(id) on delete cascade,
 thread_id uuid not null,
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 body text not null check(length(body) between 1 and 5000),
 quote text check(length(quote)<=1000),
 resolved_at timestamptz,
 resolved_by uuid references public.zarn_members(user_id) on delete set null,
 created_at timestamptz not null default now(),
 edited_at timestamptz);
create index zarn_doc_comments_doc on public.zarn_doc_comments(doc_id,created_at);
alter table public.zarn_doc_comments enable row level security;
-- Anyone who can open the document reads and adds comments; you edit or delete your own; owners and editors resolve.
create policy cmt_read on public.zarn_doc_comments for select to authenticated using(public.zarn_doc_role(doc_id) is not null);
create policy cmt_add on public.zarn_doc_comments for insert to authenticated
 with check(user_id=(select auth.uid()) and public.zarn_doc_role(doc_id) is not null and resolved_at is null);
create policy cmt_edit on public.zarn_doc_comments for update to authenticated
 using(user_id=(select auth.uid()) or public.zarn_doc_role(doc_id) in ('owner','edit'))
 with check(public.zarn_doc_role(doc_id) is not null);
create policy cmt_remove on public.zarn_doc_comments for delete to authenticated
 using(user_id=(select auth.uid()) or public.zarn_doc_role(doc_id)='owner');
revoke all on public.zarn_doc_comments from anon;
grant select,insert,delete on public.zarn_doc_comments to authenticated;
grant update(body,edited_at,resolved_at,resolved_by) on public.zarn_doc_comments to authenticated;
