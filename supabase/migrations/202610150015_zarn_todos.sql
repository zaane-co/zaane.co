-- ZARN to-dos: personal tasks, and messages saved for later (a to-do that points at a message).
create table public.zarn_todos (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 body text not null default '' check(length(body)<=500),
 message_id uuid references public.zarn_messages(id) on delete cascade,
 channel_id uuid references public.zarn_channels(id) on delete cascade,
 due_at date,
 done_at timestamptz,
 created_at timestamptz not null default now(),
 check(message_id is not null or length(trim(body))>0),
 check((message_id is null)=(channel_id is null)));
create unique index zarn_todos_saved on public.zarn_todos(user_id,message_id) where message_id is not null;
create index zarn_todos_user on public.zarn_todos(user_id,done_at);
alter table public.zarn_todos enable row level security;
create policy todos_read on public.zarn_todos for select to authenticated using(user_id=(select auth.uid()));
create policy todos_add on public.zarn_todos for insert to authenticated with check(user_id=(select auth.uid()) and public.is_zarn_member() and (message_id is null or public.zarn_can_read(channel_id)));
create policy todos_edit on public.zarn_todos for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy todos_remove on public.zarn_todos for delete to authenticated using(user_id=(select auth.uid()));
revoke update on public.zarn_todos from authenticated;
grant update(body,due_at,done_at) on public.zarn_todos to authenticated;
