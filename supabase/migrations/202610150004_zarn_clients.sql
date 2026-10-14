-- ZARN client spaces: one private conversation per client (a CRM lead), visible only to the staff assigned to it plus admins.
-- The assigned team is simply the channel's members; admins can read and post without being on the team.
begin;
-- The original inline checks have generated names, so find them by definition.
do $$ declare r record; begin
 for r in select conname from pg_constraint where conrelid='public.zarn_channels'::regclass and contype='c'
  and (pg_get_constraintdef(oid) like '%''dm''%' ) loop
  execute format('alter table public.zarn_channels drop constraint %I',r.conname);
 end loop;
end $$;
alter table public.zarn_channels add constraint zarn_channels_kind_check check(kind in ('public','private','dm','client'));
alter table public.zarn_channels add constraint zarn_channels_name_check check(kind in ('dm','client') or name ~ '^[a-z0-9][a-z0-9_-]{0,79}$');
alter table public.zarn_channels add column lead_id uuid unique references public.leads on delete cascade;
alter table public.zarn_channels add constraint zarn_client_has_lead check((kind='client')=(lead_id is not null));
drop index public.zarn_channel_name;
create unique index zarn_channel_name on public.zarn_channels(name) where kind in ('public','private');

-- Studio admins/super admins oversee every client space.
create function public.zarn_is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and exists(select 1 from public.users where id=(select auth.uid()) and role in ('super_admin','admin')) $$;
create function public.zarn_can_post(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and (public.zarn_in_channel(c) or (public.zarn_is_admin() and exists(select 1 from public.zarn_channels where id=c and kind='client'))) $$;
create or replace function public.zarn_can_read(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and (public.zarn_in_channel(c)
  or (not public.zarn_is_guest() and exists(select 1 from public.zarn_channels where id=c and kind='public'))
  or (public.zarn_is_admin() and exists(select 1 from public.zarn_channels where id=c and kind='client'))) $$;

drop policy read_visible on public.zarn_channels;
create policy read_visible on public.zarn_channels for select to authenticated using(
 public.is_zarn_member() and ((kind='public' and not public.zarn_is_guest()) or public.zarn_in_channel(id) or (kind='client' and public.zarn_is_admin())));
-- Client teams are managed through /api/zarn/clients, never by joining.
drop policy leave on public.zarn_channel_members;
create policy leave on public.zarn_channel_members for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.zarn_channels c where c.id=channel_id and c.kind in ('public','private')));

drop policy post_messages on public.zarn_messages;
create policy post_messages on public.zarn_messages for insert to authenticated with check(
 user_id=(select auth.uid()) and kind='user' and reply_count=0 and pinned_at is null and edited_at is null and deleted_at is null and invoice_id is null
 and public.zarn_can_post(channel_id) and exists(select 1 from public.zarn_channels c where c.id=zarn_messages.channel_id and c.archived_at is null)
 and (zarn_messages.parent_id is null or exists(select 1 from public.zarn_messages p where p.id=zarn_messages.parent_id and p.channel_id=zarn_messages.channel_id and p.parent_id is null)));
drop policy react on public.zarn_reactions;
create policy react on public.zarn_reactions for insert to authenticated with check(user_id=(select auth.uid()) and public.zarn_can_post(channel_id) and exists(select 1 from public.zarn_messages m where m.id=message_id and m.channel_id=zarn_reactions.channel_id));

-- Lead summary: CRM-access members see every lead; anyone sees the leads whose client space they're on.
create or replace view public.zarn_leads as
 select l.id,l.name,l.company,l.status,s.label as stage_label,s.color as stage_color,s.kind as stage_kind,l.deal_value,l.currency,
  l.categories,l.service_interested,l.owner_id,u.name as owner_name,l.created_at,l.last_activity_at
 from public.leads l left join public.pipeline_stages s on s.key=l.status left join public.users u on u.id=l.owner_id
 where public.zarn_can_crm() or public.zarn_is_admin() or exists(select 1 from public.zarn_channels c where c.lead_id=l.id and public.zarn_in_channel(c.id));
commit;
