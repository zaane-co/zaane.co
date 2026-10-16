-- ZARN assistant: saved conversations and things it was asked to remember. Each person only ever sees their own.
create table public.zarn_ai_conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 title text not null default 'New chat' check(length(title)<=120),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
create index zarn_ai_conversations_user on public.zarn_ai_conversations(user_id,updated_at desc);

create table public.zarn_ai_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.zarn_ai_conversations(id) on delete cascade,
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 role text not null check(role in ('user','assistant')),
 content text not null default '' check(length(content)<=8000),
 proposal jsonb,
 state text check(state in ('pending','done','cancelled')),
 created_at timestamptz not null default now());
create index zarn_ai_messages_conv on public.zarn_ai_messages(conversation_id,created_at);

create table public.zarn_ai_memories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 fact text not null check(length(trim(fact)) between 1 and 300),
 created_at timestamptz not null default now());
create index zarn_ai_memories_user on public.zarn_ai_memories(user_id,created_at);

alter table public.zarn_ai_conversations enable row level security;
alter table public.zarn_ai_messages enable row level security;
alter table public.zarn_ai_memories enable row level security;
create policy own_all on public.zarn_ai_conversations for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_all on public.zarn_ai_messages for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_all on public.zarn_ai_memories for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
