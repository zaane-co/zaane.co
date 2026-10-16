-- A separate daily allowance for the assistant's web searches and page reads (they cost search credits).
alter table public.zarn_ai_usage add column web integer not null default 0;
create function public.zarn_ai_consume_web(uid uuid, cap integer) returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
 insert into public.zarn_ai_usage(user_id,day,count,web) values(uid,current_date,0,1)
  on conflict (user_id,day) do update set web=public.zarn_ai_usage.web+1 returning web into n;
 return n<=cap;
end $$;
revoke all on function public.zarn_ai_consume_web(uuid,integer) from public,anon,authenticated;
grant execute on function public.zarn_ai_consume_web(uuid,integer) to service_role;
