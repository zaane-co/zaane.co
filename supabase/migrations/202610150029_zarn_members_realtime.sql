-- People joining, leaving, being deactivated or changing their profile show up live for everyone (no refresh).
alter table public.zarn_members replica identity full;
alter publication supabase_realtime add table public.zarn_members;
