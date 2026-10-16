-- ZARN assistant: a per-person daily request counter so the AI allowance can't be used up by one account.
create table public.zarn_ai_usage (
 user_id uuid not null references public.zarn_members(user_id) on delete cascade,
 day date not null default current_date,
 count integer not null default 0,
 primary key(user_id,day));
alter table public.zarn_ai_usage enable row level security;
-- No policies: only the server (service role) touches this table.
create function public.zarn_ai_consume(uid uuid, cap integer) returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
 insert into public.zarn_ai_usage(user_id,day,count) values(uid,current_date,1)
  on conflict (user_id,day) do update set count=public.zarn_ai_usage.count+1 returning count into n;
 delete from public.zarn_ai_usage where day<current_date-7;
 return n<=cap;
end $$;
revoke all on function public.zarn_ai_consume(uuid,integer) from public,anon,authenticated;
grant execute on function public.zarn_ai_consume(uuid,integer) to service_role;
