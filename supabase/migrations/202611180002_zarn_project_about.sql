-- The project's About page beyond the written overview (brief): goals, core deliverables, onboarding notes,
-- key links, status and dates, kept together as one JSON document.
alter table public.zarn_projects add column about jsonb not null default '{}'::jsonb check(pg_column_size(about)<=200000);
grant update(about) on public.zarn_projects to authenticated;
