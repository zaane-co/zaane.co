-- Deal values are for admins only. ZARN's lead view blanks the amount for everyone else.
create or replace view public.zarn_leads as
 select l.id, l.name, l.company, l.status,
  s.label as stage_label, s.color as stage_color, s.kind as stage_kind,
  (case when public.zarn_is_admin() then l.deal_value else null end)::numeric(14,2) as deal_value,
  l.currency, l.categories, l.service_interested, l.owner_id,
  u.name as owner_name, l.created_at, l.last_activity_at
 from public.leads l
 left join public.pipeline_stages s on s.key = l.status
 left join public.users u on u.id = l.owner_id
 where public.zarn_can_crm() or public.zarn_is_admin()
  or exists (select 1 from public.zarn_channels c where c.lead_id = l.id and public.zarn_in_channel(c.id));
