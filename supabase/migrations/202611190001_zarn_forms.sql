-- Forms, like Google Forms. A form is a doc with kind='form' (its questions are the JSON content), so sharing,
-- folders, drives, trash and Recent all work the same. Answers are stored here; they are written by the server
-- (people outside ZARN can answer a public form), and only the form's owner and editors can read or delete them.
alter table public.zarn_docs drop constraint if exists zarn_docs_kind_check;
alter table public.zarn_docs add constraint zarn_docs_kind_check check(kind in ('doc','sheet','form'));

create table public.zarn_form_responses (
 id uuid primary key default gen_random_uuid(),
 doc_id uuid not null references public.zarn_docs(id) on delete cascade,
 user_id uuid references public.zarn_members(user_id) on delete set null,
 email text,
 answers jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now());
create index zarn_form_responses_doc on public.zarn_form_responses(doc_id,created_at desc);
create index zarn_form_responses_user on public.zarn_form_responses(doc_id,user_id) where user_id is not null;
alter table public.zarn_form_responses enable row level security;
create policy form_resp_read on public.zarn_form_responses for select to authenticated
 using(public.zarn_doc_role(doc_id) in ('owner','edit'));
create policy form_resp_remove on public.zarn_form_responses for delete to authenticated
 using(public.zarn_doc_role(doc_id) in ('owner','edit'));
grant select,delete on public.zarn_form_responses to authenticated;
