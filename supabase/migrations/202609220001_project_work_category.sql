alter table public.projects add column work_category text not null default '';
alter table public.projects add constraint projects_work_category_check check (work_category = '' or work_category in ('Website','Graphic Design','Branding','Logo','Social Media','App','Ecommerce','UI/UX'));
