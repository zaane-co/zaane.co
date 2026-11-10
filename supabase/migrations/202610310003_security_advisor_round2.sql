-- Supabase Security Advisor, round two.
--
-- 1. Server-only tables had RLS on and no policy. That already denies everyone, so add an explicit deny to say it is on purpose.
-- 2. The public site read published rows through policies that also called staff_role(), which forced signed-out visitors to hold
--    EXECUTE on it. Split each policy: signed-out visitors see published rows, signed-in users keep the staff check.
-- 3. RLS helper functions only need to be callable from policies, so move them to a schema the API does not expose. Policies, views
--    and triggers point at functions by id, so they follow the move. Function bodies that call a helper by name are rewritten.
--    The six zarn_* functions the browser calls through rpc() stay in public.

-- 1.
do $$
declare t text;
begin
 foreach t in array array['rate_limits','zarn_ai_usage','zarn_care_alert_seen','zarn_care_alerts','zarn_client_deliverables','zarn_client_receipts','zarn_client_reminders','zarn_deliverable_log','zarn_doc_links','zarn_link_previews','zarn_push_subscriptions','zarn_vault_items','zarn_vault_log','zarn_vault_share_items','zarn_vault_shares'] loop
  execute format('create policy server_only on public.%I for all to anon, authenticated using(false) with check(false)',t);
 end loop;
end $$;

-- 2.
do $$
declare t text;
begin
 foreach t in array array['blog_posts','jobs','projects','resources','team_members','testimonials'] loop
  execute format('drop policy public_read on public.%I',t);
  execute format('create policy public_read on public.%I for select to anon using(status=%L)',t,'published');
  execute format('create policy staff_read on public.%I for select to authenticated using(status=%L or (select public.staff_role()) = any(array[%L,%L,%L]))',t,'published','super_admin','admin','editor');
 end loop;
end $$;
drop policy public_read on public.blog_curated;
create policy public_read on public.blog_curated for select to anon using(published);
create policy staff_read on public.blog_curated for select to authenticated using(published or (select public.staff_role()) = any(array['super_admin','admin','editor']));

-- 3.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

do $$
declare
 moved text[] := array['is_zarn_member','staff_role','zarn_can_crm','zarn_can_post','zarn_can_read','zarn_can_see_task','zarn_file_shared_with_me','zarn_in_channel','zarn_in_client','zarn_in_project','zarn_is_admin','zarn_is_assignee','zarn_is_guest','zarn_is_team_member','zarn_leads_visible','zarn_owns_file','zarn_project_owner','zarn_shares_channel'];
 f record; def text; pat text;
begin
 pat := 'public\.(' || array_to_string(moved,'|') || ')\(';
 for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=any(moved) loop
  execute format('alter function %s set schema private',f.sig);
 end loop;
 -- Rewrite every function that still calls a moved helper through public.
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname not in ('pg_catalog','information_schema') and p.prokind='f' and pg_get_functiondef(p.oid) ~ pat loop
  def := regexp_replace(pg_get_functiondef(f.oid),pat,'private.\1(','g');
  execute def;
 end loop;
end $$;

-- Only signed-in users and the server may call the helpers; the grants moved with the functions, so close the rest.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace='private'::regnamespace loop
  execute format('revoke execute on function %s from public, anon',f.sig);
 end loop;
end $$;
