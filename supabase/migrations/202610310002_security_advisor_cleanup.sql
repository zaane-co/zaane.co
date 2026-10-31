-- Supabase Security Advisor cleanup.
--
-- Functions in public are callable through the REST API (/rest/v1/rpc/<name>) by whoever holds EXECUTE. Postgres grants EXECUTE
-- to PUBLIC by default and Supabase also grants it to anon and authenticated, so every SECURITY DEFINER helper was callable by
-- signed-out visitors.
--
-- Kept on purpose:
--  * staff_role(): the public website reads published CMS rows as anon, and those policies call it.
--  * authenticated on the RLS helper functions and the ZARN rpc functions: policies run as the signed-in user, and the app calls
--    zarn_open_dm, zarn_mark_read, zarn_mark_delivered, zarn_doc_role, zarn_doc_seed and zarn_doc_compact as that user.
--    Moving the helpers to another schema would break the stored bodies of the functions that call them by name.

-- 1. Nobody needs to call a SECURITY DEFINER function as a signed-out visitor, except staff_role().
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as sig,p.prorettype::regtype::text as ret from pg_proc p
  where p.pronamespace='public'::regnamespace and p.prosecdef and p.proname<>'staff_role' loop
  execute format('revoke execute on function %s from public, anon',f.sig);
  -- Trigger functions are fired by the database. Firing one never checks the caller's EXECUTE, so nobody needs it.
  if f.ret in ('trigger','event_trigger') then execute format('revoke execute on function %s from authenticated',f.sig); end if;
 end loop;
end $$;

-- 2. Two trigger functions had no pinned search_path and were also callable through the API.
alter function public.zarn_docs_touch() set search_path='';
alter function public.zarn_message_author_clear() set search_path='';
revoke execute on function public.zarn_docs_touch() from public, anon, authenticated;
revoke execute on function public.zarn_message_author_clear() from public, anon, authenticated;

-- 3. The media bucket is public, so its files load from their URL without a read policy. That policy only let anyone list every file.
drop policy if exists media_read on storage.objects;
