-- Thread replies were rejected: inside the subquery, a bare parent_id resolved to the subquery's own column.
begin;
drop policy post_messages on public.zarn_messages;
create policy post_messages on public.zarn_messages for insert to authenticated with check(
 user_id=(select auth.uid()) and kind='user' and reply_count=0 and pinned_at is null and edited_at is null and deleted_at is null and invoice_id is null
 and public.zarn_in_channel(channel_id) and exists(select 1 from public.zarn_channels c where c.id=zarn_messages.channel_id and c.archived_at is null)
 and (zarn_messages.parent_id is null or exists(select 1 from public.zarn_messages p where p.id=zarn_messages.parent_id and p.channel_id=zarn_messages.channel_id and p.parent_id is null)));
commit;
