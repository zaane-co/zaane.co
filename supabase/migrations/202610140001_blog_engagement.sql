-- Blog engagement (Finance with Anne): views + read time, likes, moderated comments, curated links, editor bios.
-- Public writes go through server routes using the service role, so anon/authenticated get no direct write access.
begin;
create table public.blog_post_views (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.blog_posts on delete cascade, country text, read_duration_seconds integer check(read_duration_seconds between 0 and 86400), created_at timestamptz not null default now());
create index blog_post_views_post on public.blog_post_views(post_id);
create table public.blog_likes (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.blog_posts on delete cascade, fingerprint text not null, created_at timestamptz not null default now(), unique(post_id,fingerprint));
create table public.blog_comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.blog_posts on delete cascade, author_name text not null, author_email text, content text not null, approved boolean not null default false, admin_reply text, replied_at timestamptz, created_at timestamptz not null default now());
create index blog_comments_post on public.blog_comments(post_id,approved,created_at);
create table public.blog_curated (id uuid primary key default gen_random_uuid(), url text not null, source_name text not null, title text not null, excerpt text, cover_image text, published boolean not null default true, created_at timestamptz not null default now());
alter table public.users add column bio text not null default '';

alter table public.blog_post_views enable row level security;
alter table public.blog_likes enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_curated enable row level security;
create policy staff_read on public.blog_post_views for select to authenticated using(public.staff_role() in ('super_admin','admin','editor'));
create policy staff_read on public.blog_likes for select to authenticated using(public.staff_role() in ('super_admin','admin','editor'));
create policy staff_read on public.blog_comments for select to authenticated using(public.staff_role() in ('super_admin','admin','editor'));
create policy admin_manage on public.blog_comments for all to authenticated using(public.staff_role() in ('super_admin','admin')) with check(public.staff_role() in ('super_admin','admin'));
create policy public_read on public.blog_curated for select to anon,authenticated using(published or public.staff_role() in ('super_admin','admin','editor'));
create policy admin_manage on public.blog_curated for all to authenticated using(public.staff_role() in ('super_admin','admin')) with check(public.staff_role() in ('super_admin','admin'));
commit;
