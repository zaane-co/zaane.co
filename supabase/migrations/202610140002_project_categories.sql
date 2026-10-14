-- Admin-managed project categories (category, subcategory, selected-work tab) instead of hardcoded lists.
begin;
create table public.project_categories (id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('category','sub_category','work_category')), name text not null check(length(trim(name)) between 1 and 80), created_at timestamptz not null default now(), unique(kind,name));
alter table public.project_categories enable row level security;
create policy public_read on public.project_categories for select to anon,authenticated using(true);
create policy admin_manage on public.project_categories for all to authenticated using(public.staff_role() in ('super_admin','admin')) with check(public.staff_role() in ('super_admin','admin'));
insert into public.project_categories(kind,name) values
 ('category','Design'),('category','Development'),
 ('sub_category','Graphics & Brand Design'),('sub_category','UI/UX Design'),('sub_category','Web Design'),('sub_category','App Design'),
 ('work_category','Website'),('work_category','Graphic Design'),('work_category','Branding'),('work_category','Logo'),('work_category','Social Media'),('work_category','App'),('work_category','Ecommerce'),('work_category','UI/UX')
on conflict do nothing;
insert into public.project_categories(kind,name) select distinct 'category',category from public.projects where category<>'' on conflict do nothing;
insert into public.project_categories(kind,name) select distinct 'sub_category',sub_category from public.projects where sub_category<>'' on conflict do nothing;
insert into public.project_categories(kind,name) select distinct 'work_category',work_category from public.projects where work_category<>'' on conflict do nothing;
alter table public.projects drop constraint if exists projects_work_category_check;
commit;
