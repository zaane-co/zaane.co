-- ZARN access controls (modelled on Slack): member vs guest, per-person CRM + channel-creation toggles, guest expiry.
-- Guests only see channels they were added to, can't browse or join public channels, and only see/DM people they share a channel with.
begin;
alter table public.zarn_members
 add column account_type text not null default 'member' check(account_type in ('member','guest')),
 add column can_view_crm boolean not null default true,
 add column can_create_channels boolean not null default true,
 add column expires_at timestamptz;

-- Active = not deactivated and not past an expiry date.
create or replace function public.is_zarn_member() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.zarn_members where user_id=(select auth.uid()) and deactivated_at is null and (expires_at is null or expires_at>now())) $$;
create function public.zarn_is_guest() returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce((select account_type='guest' from public.zarn_members where user_id=(select auth.uid())),true) $$;
create function public.zarn_can_crm() returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and coalesce((select can_view_crm from public.zarn_members where user_id=(select auth.uid())),false) $$;
create function public.zarn_shares_channel(other uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.zarn_channel_members a join public.zarn_channel_members b on a.channel_id=b.channel_id where a.user_id=(select auth.uid()) and b.user_id=other) $$;
create or replace function public.zarn_can_read(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and (public.zarn_in_channel(c) or (not public.zarn_is_guest() and exists(select 1 from public.zarn_channels where id=c and kind='public'))) $$;

drop policy read_team on public.zarn_members;
create policy read_team on public.zarn_members for select to authenticated using(
 user_id=(select auth.uid()) or (public.is_zarn_member() and (not public.zarn_is_guest() or public.zarn_shares_channel(user_id))));
drop policy read_visible on public.zarn_channels;
create policy read_visible on public.zarn_channels for select to authenticated using(
 public.is_zarn_member() and ((kind='public' and not public.zarn_is_guest()) or public.zarn_in_channel(id)));
drop policy join_public on public.zarn_channel_members;
create policy join_public on public.zarn_channel_members for insert to authenticated with check(
 user_id=(select auth.uid()) and public.is_zarn_member() and not public.zarn_is_guest()
 and exists(select 1 from public.zarn_channels c where c.id=channel_id and c.kind='public' and c.archived_at is null));

-- CRM window only for people with CRM access.
create or replace view public.zarn_leads as
 select l.id,l.name,l.company,l.status,s.label as stage_label,s.color as stage_color,s.kind as stage_kind,l.deal_value,l.currency,
  l.categories,l.service_interested,l.owner_id,u.name as owner_name,l.created_at,l.last_activity_at
 from public.leads l left join public.pipeline_stages s on s.key=l.status left join public.users u on u.id=l.owner_id
 where public.zarn_can_crm();

-- DMs: guests can only start conversations with people they share a channel with.
create or replace function public.zarn_open_dm(others uuid[]) returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); ids uuid[]; k text; cid uuid; o uuid;
begin
 if not public.is_zarn_member() then raise exception 'not a member'; end if;
 select array_agg(distinct x order by x) into ids from unnest(array_append(others,me)) x;
 if array_length(ids,1)>9 then raise exception 'too many people'; end if;
 if (select count(*) from public.zarn_members where user_id=any(ids) and deactivated_at is null and (expires_at is null or expires_at>now()))<>array_length(ids,1) then raise exception 'unknown member'; end if;
 if public.zarn_is_guest() then
  foreach o in array others loop if o<>me and not public.zarn_shares_channel(o) then raise exception 'guests can only message people in their channels'; end if; end loop;
 end if;
 k := array_to_string(ids,',');
 select id into cid from public.zarn_channels where dm_key=k;
 if cid is null then
  insert into public.zarn_channels(kind,dm_key,created_by) values('dm',k,me) returning id into cid;
  insert into public.zarn_channel_members(channel_id,user_id) select cid,x from unnest(ids) x;
 end if;
 return cid;
end $$;
commit;
