-- Like Google Drive: anyone who can edit a folder can share it, as Viewer or Editor. Only owners and Managers can
-- make someone a Manager, remove a Manager, or change the folder's general access.
create or replace function public.zarn_folder_role(f uuid) returns text language sql stable security definer set search_path='' as $$
 select private.zarn_place_role(f) $$;
grant execute on function public.zarn_folder_role(uuid) to authenticated;

drop policy fm_add on public.zarn_drive_folder_members;
drop policy fm_edit on public.zarn_drive_folder_members;
drop policy fm_remove on public.zarn_drive_folder_members;
create policy fm_add on public.zarn_drive_folder_members for insert to authenticated
 with check((private.zarn_place_role(folder_id)='owner' or (private.zarn_place_role(folder_id)='edit' and role in ('view','edit')))
  and exists(select 1 from public.zarn_members m where m.user_id=zarn_drive_folder_members.user_id and m.deactivated_at is null and m.account_type='member'));
create policy fm_edit on public.zarn_drive_folder_members for update to authenticated
 using(private.zarn_place_role(folder_id)='owner' or (private.zarn_place_role(folder_id)='edit' and role<>'manage'))
 with check(private.zarn_place_role(folder_id)='owner' or (private.zarn_place_role(folder_id)='edit' and role in ('view','edit')));
create policy fm_remove on public.zarn_drive_folder_members for delete to authenticated
 using(user_id=(select auth.uid()) or private.zarn_place_role(folder_id)='owner' or (private.zarn_place_role(folder_id)='edit' and role<>'manage'));
