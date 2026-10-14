-- Blog admin (Finance with Anne layout): SEO fields, featured post, subcategories, multi-category posts.
begin;
alter table public.blog_posts add column meta_title text not null default '';
alter table public.blog_posts add column meta_description text not null default '';
alter table public.blog_posts add column focus_keyword text not null default '';
alter table public.blog_posts add column featured boolean not null default false;
create unique index blog_one_featured on public.blog_posts(featured) where featured;
alter table public.blog_categories add column parent_id uuid references public.blog_categories on delete cascade;
create table public.blog_post_categories (post_id uuid not null references public.blog_posts on delete cascade, category_id uuid not null references public.blog_categories on delete cascade, primary key(post_id,category_id));
create index blog_post_categories_category on public.blog_post_categories(category_id);
insert into public.blog_post_categories(post_id,category_id) select id,category_id from public.blog_posts where category_id is not null;
alter table public.blog_post_categories enable row level security;
create policy public_read on public.blog_post_categories for select to anon,authenticated using(true);
create policy staff_manage on public.blog_post_categories for all to authenticated
 using(public.staff_role() in ('super_admin','admin') or (public.staff_role()='editor' and exists(select 1 from public.blog_posts where id=post_id and status in ('draft','review'))))
 with check(public.staff_role() in ('super_admin','admin') or (public.staff_role()='editor' and exists(select 1 from public.blog_posts where id=post_id and status in ('draft','review'))));
commit;
