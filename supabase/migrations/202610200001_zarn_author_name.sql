-- Keep a removed member's name on their messages, so history still shows who said what
-- (messages.user_id is set null when the member row goes).
alter table public.zarn_messages add column author_name text check(length(author_name)<=80);

-- Only the database writes it: clear anything sent with a new message.
create or replace function public.zarn_message_author_clear() returns trigger language plpgsql as $$
begin new.author_name:=null; return new; end $$;
create trigger zarn_message_author_clear before insert on public.zarn_messages for each row execute function public.zarn_message_author_clear();

-- Snapshot the name just before the member row is deleted (directly, or via auth user cascade).
create or replace function public.zarn_member_author_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.zarn_messages set author_name=old.display_name where user_id=old.user_id;
 return old;
end $$;
create trigger zarn_member_author_snapshot before delete on public.zarn_members for each row execute function public.zarn_member_author_snapshot();
