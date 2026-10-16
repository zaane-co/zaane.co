-- A written brief on every project: what it is, the goals, scope and deadlines.
alter table public.zarn_projects add column brief text not null default '' check (length(brief) <= 20000);
