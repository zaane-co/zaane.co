-- "About me" on ZARN profiles: a short bio people write about themselves.
alter table public.zarn_members add column if not exists bio text not null default '' check (char_length(bio) <= 600);
grant update(bio) on public.zarn_members to authenticated;
