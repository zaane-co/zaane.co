-- zarn_leads was a SECURITY DEFINER view (flagged by the Supabase security advisor). The access check now lives in a
-- security definer function, and the view runs as the caller and just reads from it. Who sees what is unchanged:
-- admins, the Sales role, and each client's own team. Deal values stay admin-only.
begin;
create or replace function public.zarn_leads_visible() returns table(
 id uuid, name text, company text, status text, stage_label text, stage_color text, stage_kind text, deal_value numeric(14,2),
 currency text, categories text[], service_interested text, owner_id uuid, owner_name text, created_at timestamptz, last_activity_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select l.id, l.name, l.company, l.status,
  s.label, s.color, s.kind,
  (case when public.zarn_is_admin() then l.deal_value else null end)::numeric(14,2),
  l.currency, l.categories, l.service_interested, l.owner_id,
  u.name, l.created_at, l.last_activity_at
 from public.leads l
 left join public.pipeline_stages s on s.key = l.status
 left join public.users u on u.id = l.owner_id
 where public.zarn_is_admin()
  or exists (select 1 from public.users x where x.id=(select auth.uid()) and x.role='sales')
  or exists (select 1 from public.zarn_channels c where c.lead_id = l.id and public.zarn_in_channel(c.id)) $$;
revoke all on function public.zarn_leads_visible() from public, anon;
grant execute on function public.zarn_leads_visible() to authenticated;

drop view public.zarn_leads;
create view public.zarn_leads with (security_invoker = true) as select * from public.zarn_leads_visible();
revoke all on public.zarn_leads from anon, public;
grant select on public.zarn_leads to authenticated;
commit;
