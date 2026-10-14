-- ZARN: Zaane's in-house team chat. Invite-only members, channels + DMs, threads, reactions, mentions,
-- and a read-only window onto the CRM. Reads happen in the browser over RLS + Realtime; privileged writes go through /api/zarn.
begin;

create table public.zarn_members (
 user_id uuid primary key references auth.users on delete cascade,
 email text not null,
 display_name text not null check(length(trim(display_name)) between 1 and 80),
 title text not null default '' check(length(title)<=80),
 status_text text not null default '' check(length(status_text)<=100),
 avatar_url text,
 invited_by uuid references auth.users on delete set null,
 joined_at timestamptz,          -- null until they accept the invite and set a password
 deactivated_at timestamptz,     -- deactivated members keep their history but can't sign in
 last_seen_at timestamptz,
 created_at timestamptz not null default now());

create function public.is_zarn_member() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.zarn_members where user_id=(select auth.uid()) and deactivated_at is null) $$;

create table public.zarn_channels (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('public','private','dm')),
 name text check(kind='dm' or name ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
 topic text not null default '' check(length(topic)<=250),
 crm_feed text check(crm_feed in ('leads','invoices')),   -- channels that receive automatic CRM posts
 dm_key text unique,                                       -- sorted member ids, so a DM is found again instead of duplicated
 is_default boolean not null default false,                -- new members join these automatically
 created_by uuid references auth.users on delete set null,
 archived_at timestamptz,
 created_at timestamptz not null default now());
create unique index zarn_channel_name on public.zarn_channels(name) where kind<>'dm';

create table public.zarn_channel_members (
 channel_id uuid not null references public.zarn_channels on delete cascade,
 user_id uuid not null references public.zarn_members on delete cascade,
 last_read_at timestamptz not null default now(),
 muted boolean not null default false,
 starred boolean not null default false,
 joined_at timestamptz not null default now(),
 primary key(channel_id,user_id));
create index zarn_channel_members_user on public.zarn_channel_members(user_id);

create function public.zarn_in_channel(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.zarn_channel_members where channel_id=c and user_id=(select auth.uid())) $$;
create function public.zarn_can_read(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_zarn_member() and (public.zarn_in_channel(c) or exists(select 1 from public.zarn_channels where id=c and kind='public')) $$;

create table public.zarn_messages (
 id uuid primary key default gen_random_uuid(),
 channel_id uuid not null references public.zarn_channels on delete cascade,
 user_id uuid references public.zarn_members on delete set null,
 parent_id uuid references public.zarn_messages on delete cascade,
 body text not null default '' check(length(body)<=8000),
 attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array'),
 lead_id uuid references public.leads on delete set null,
 invoice_id uuid references public.invoices on delete set null,
 kind text not null default 'user' check(kind in ('user','system','crm')),
 meta jsonb not null default '{}',
 reply_count integer not null default 0,
 last_reply_at timestamptz,
 pinned_at timestamptz, pinned_by uuid references auth.users on delete set null,
 edited_at timestamptz, deleted_at timestamptz,
 created_at timestamptz not null default now());
create index zarn_messages_channel on public.zarn_messages(channel_id,created_at desc) where parent_id is null;
create index zarn_messages_thread on public.zarn_messages(parent_id,created_at) where parent_id is not null;

create table public.zarn_reactions (
 message_id uuid not null references public.zarn_messages on delete cascade,
 user_id uuid not null references public.zarn_members on delete cascade,
 channel_id uuid not null references public.zarn_channels on delete cascade,
 emoji text not null check(length(emoji) between 1 and 32),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,emoji));

create table public.zarn_mentions (
 message_id uuid not null references public.zarn_messages on delete cascade,
 user_id uuid not null references public.zarn_members on delete cascade,
 channel_id uuid not null references public.zarn_channels on delete cascade,
 read_at timestamptz,
 created_at timestamptz not null default now(),
 primary key(message_id,user_id));
create index zarn_mentions_open on public.zarn_mentions(user_id) where read_at is null;

-- RLS. Column grants keep self-service updates to harmless fields.
alter table public.zarn_members enable row level security;
create policy read_team on public.zarn_members for select to authenticated using(public.is_zarn_member() or user_id=(select auth.uid()));
create policy edit_self on public.zarn_members for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke update on public.zarn_members from authenticated;
grant update(display_name,title,status_text,avatar_url,last_seen_at) on public.zarn_members to authenticated;

alter table public.zarn_channels enable row level security;
create policy read_visible on public.zarn_channels for select to authenticated using(public.is_zarn_member() and (kind='public' or public.zarn_in_channel(id)));

alter table public.zarn_channel_members enable row level security;
create policy read_members on public.zarn_channel_members for select to authenticated using(user_id=(select auth.uid()) or public.zarn_can_read(channel_id));
create policy join_public on public.zarn_channel_members for insert to authenticated with check(user_id=(select auth.uid()) and public.is_zarn_member() and exists(select 1 from public.zarn_channels c where c.id=channel_id and c.kind='public' and c.archived_at is null));
create policy update_self on public.zarn_channel_members for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy leave on public.zarn_channel_members for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.zarn_channels c where c.id=channel_id and c.kind<>'dm'));
revoke update on public.zarn_channel_members from authenticated;
grant update(last_read_at,muted,starred) on public.zarn_channel_members to authenticated;

alter table public.zarn_messages enable row level security;
create policy read_messages on public.zarn_messages for select to authenticated using(public.zarn_can_read(channel_id));
create policy post_messages on public.zarn_messages for insert to authenticated with check(
 user_id=(select auth.uid()) and kind='user' and reply_count=0 and pinned_at is null and edited_at is null and deleted_at is null and invoice_id is null
 and public.zarn_in_channel(channel_id) and exists(select 1 from public.zarn_channels c where c.id=channel_id and c.archived_at is null)
 and (parent_id is null or exists(select 1 from public.zarn_messages p where p.id=parent_id and p.channel_id=zarn_messages.channel_id and p.parent_id is null)));
create policy edit_own on public.zarn_messages for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke update on public.zarn_messages from authenticated;
grant update(body,edited_at,deleted_at) on public.zarn_messages to authenticated;

alter table public.zarn_reactions enable row level security;
create policy read_reactions on public.zarn_reactions for select to authenticated using(public.zarn_can_read(channel_id));
create policy react on public.zarn_reactions for insert to authenticated with check(user_id=(select auth.uid()) and public.zarn_in_channel(channel_id) and exists(select 1 from public.zarn_messages m where m.id=message_id and m.channel_id=zarn_reactions.channel_id));
create policy unreact on public.zarn_reactions for delete to authenticated using(user_id=(select auth.uid()));

alter table public.zarn_mentions enable row level security;
create policy read_own on public.zarn_mentions for select to authenticated using(user_id=(select auth.uid()));
create policy mark_read on public.zarn_mentions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke update on public.zarn_mentions from authenticated;
grant update(read_at) on public.zarn_mentions to authenticated;

-- New message side effects: thread counts, @mentions, and the sender's own read marker.
create function public.zarn_after_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.parent_id is not null then
  update public.zarn_messages set reply_count=reply_count+1,last_reply_at=new.created_at where id=new.parent_id;
 end if;
 insert into public.zarn_mentions(message_id,user_id,channel_id)
  select new.id,m.user_id,new.channel_id from public.zarn_members m
  where m.deactivated_at is null and m.user_id is distinct from new.user_id
   and (position('<@'||m.user_id::text||'>' in new.body)>0
        or (position('<!channel>' in new.body)>0 and exists(select 1 from public.zarn_channel_members cm where cm.channel_id=new.channel_id and cm.user_id=m.user_id)))
   and exists(select 1 from public.zarn_channels c where c.id=new.channel_id and (c.kind='public' or exists(select 1 from public.zarn_channel_members cm where cm.channel_id=c.id and cm.user_id=m.user_id)))
  on conflict do nothing;
 if new.user_id is not null then update public.zarn_channel_members set last_read_at=new.created_at where channel_id=new.channel_id and user_id=new.user_id; end if;
 return null;
end $$;
create trigger zarn_message_after after insert on public.zarn_messages for each row execute function public.zarn_after_message();

-- Unread + mention counts for the sidebar.
create function public.zarn_unread() returns table(channel_id uuid,unread integer,mentions integer) language sql stable set search_path = '' as $$
 select cm.channel_id,
  (select count(*)::int from public.zarn_messages m where m.channel_id=cm.channel_id and m.parent_id is null and m.deleted_at is null and m.created_at>cm.last_read_at and m.user_id is distinct from cm.user_id),
  (select count(*)::int from public.zarn_mentions z where z.channel_id=cm.channel_id and z.user_id=cm.user_id and z.read_at is null)
 from public.zarn_channel_members cm where cm.user_id=(select auth.uid()) $$;

-- Find or create a DM (1:1 or small group) between the caller and others.
create function public.zarn_open_dm(others uuid[]) returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); ids uuid[]; k text; cid uuid;
begin
 if not public.is_zarn_member() then raise exception 'not a member'; end if;
 select array_agg(distinct x order by x) into ids from unnest(array_append(others,me)) x;
 if array_length(ids,1)>9 then raise exception 'too many people'; end if;
 if (select count(*) from public.zarn_members where user_id=any(ids) and deactivated_at is null)<>array_length(ids,1) then raise exception 'unknown member'; end if;
 k := array_to_string(ids,',');
 select id into cid from public.zarn_channels where dm_key=k;
 if cid is null then
  insert into public.zarn_channels(kind,dm_key,created_by) values('dm',k,me) returning id into cid;
  insert into public.zarn_channel_members(channel_id,user_id) select cid,x from unnest(ids) x;
 end if;
 return cid;
end $$;
revoke all on function public.zarn_open_dm(uuid[]) from public, anon;
grant execute on function public.zarn_open_dm(uuid[]) to authenticated;

-- Read-only CRM window for every ZARN member: summary fields only (no briefs, emails or notes).
create view public.zarn_leads as
 select l.id,l.name,l.company,l.status,s.label as stage_label,s.color as stage_color,s.kind as stage_kind,l.deal_value,l.currency,
  l.categories,l.service_interested,l.owner_id,u.name as owner_name,l.created_at,l.last_activity_at
 from public.leads l left join public.pipeline_stages s on s.key=l.status left join public.users u on u.id=l.owner_id
 where public.is_zarn_member();
revoke all on public.zarn_leads from anon, public;
grant select on public.zarn_leads to authenticated;

-- Automatic CRM posts into channels flagged with a crm_feed.
create function public.zarn_crm_post(feed text,lead uuid,inv uuid,meta jsonb) returns void language sql security definer set search_path = '' as $$
 insert into public.zarn_messages(channel_id,kind,lead_id,invoice_id,meta)
 select id,'crm',lead,inv,meta from public.zarn_channels where crm_feed=feed and archived_at is null $$;
create function public.zarn_lead_events() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then perform public.zarn_crm_post('leads',new.id,null,jsonb_build_object('event','lead_created','source',new.source));
 elsif new.status is distinct from old.status then perform public.zarn_crm_post('leads',new.id,null,jsonb_build_object('event','stage','from',old.status,'to',new.status));
 end if;
 return null;
end $$;
create trigger zarn_lead_events after insert or update of status on public.leads for each row execute function public.zarn_lead_events();
create function public.zarn_invoice_events() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status is distinct from old.status and new.status in ('sent','paid') then
  perform public.zarn_crm_post('invoices',new.lead_id,new.id,jsonb_build_object('event','invoice_'||new.status,'number',new.number,'total',new.total,'currency',new.currency));
 end if;
 return null;
end $$;
create trigger zarn_invoice_events after update of status on public.invoices for each row execute function public.zarn_invoice_events();

-- Starter channels.
insert into public.zarn_channels(kind,name,topic,is_default,crm_feed) values
 ('public','general','Company-wide announcements and chat',true,null),
 ('public','random','Everything else',true,null),
 ('public','sales','New leads and deal updates from the CRM',false,'leads'),
 ('private','finance','Invoices sent and paid',false,'invoices');

-- Live updates over Supabase Realtime (RLS still applies per subscriber).
alter publication supabase_realtime add table public.zarn_messages, public.zarn_reactions, public.zarn_channel_members, public.zarn_channels, public.zarn_mentions;
commit;
