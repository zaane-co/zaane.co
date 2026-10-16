-- Live co-editing of documents. Edits are small updates stored in order; everyone who has the document open receives them as they land.
create table public.zarn_doc_updates (
 id bigint generated always as identity primary key,
 doc_id uuid not null references public.zarn_docs(id) on delete cascade,
 data text not null check (length(data) <= 2000000),
 client text not null,
 created_at timestamptz not null default now()
);
create index zarn_doc_updates_doc_idx on public.zarn_doc_updates(doc_id,id);
alter table public.zarn_doc_updates enable row level security;
create policy read_updates on public.zarn_doc_updates for select to authenticated using(public.zarn_doc_role(doc_id) is not null);
create policy add_updates on public.zarn_doc_updates for insert to authenticated with check(public.zarn_doc_role(doc_id) in ('owner','edit'));
alter publication supabase_realtime add table public.zarn_doc_updates;

-- First open of a document written before live editing: its text becomes the starting state, once (the first to try wins).
create function public.zarn_doc_seed(d uuid, payload text, who text) returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if public.zarn_doc_role(d) not in ('owner','edit') then return false; end if;
 perform 1 from public.zarn_docs where id=d for update;
 if exists(select 1 from public.zarn_doc_updates where doc_id=d) then return false; end if;
 insert into public.zarn_doc_updates(doc_id,data,client) values(d,payload,who);
 return true;
end $$;
-- Folds the history so far into one entry so documents stay quick to open.
create function public.zarn_doc_compact(d uuid, upto bigint, payload text, who text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if public.zarn_doc_role(d) not in ('owner','edit') then return; end if;
 perform 1 from public.zarn_docs where id=d for update;
 delete from public.zarn_doc_updates where doc_id=d and id<=upto;
 insert into public.zarn_doc_updates(doc_id,data,client) values(d,payload,who);
end $$;
revoke all on function public.zarn_doc_seed(uuid,text,text) from public,anon;
revoke all on function public.zarn_doc_compact(uuid,bigint,text,text) from public,anon;
grant execute on function public.zarn_doc_seed(uuid,text,text) to authenticated;
grant execute on function public.zarn_doc_compact(uuid,bigint,text,text) to authenticated;
