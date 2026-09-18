-- Zaane agency CMS. Apply once to a dedicated Supabase project.
begin;
create type public.staff_role as enum ('super_admin','admin','editor');
create type public.publish_status as enum ('draft','review','published');
create table public.users (id uuid primary key references auth.users on delete cascade, email text not null, name text not null default '', role public.staff_role, avatar_url text, created_at timestamptz not null default now());
create function public.staff_role() returns text language sql stable security definer set search_path = '' as $$ select role::text from public.users where id = (select auth.uid()) $$;
revoke all on function public.staff_role() from public;
grant execute on function public.staff_role() to anon, authenticated;
create function public.new_user() returns trigger language plpgsql security definer set search_path = '' as $$ begin insert into public.users(id,email) values(new.id,new.email); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_user();
create table public.blog_categories (id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, created_at timestamptz not null default now());
create table public.blog_posts (id uuid primary key default gen_random_uuid(), title text not null, slug text unique not null, excerpt text not null default '', content text not null default '', cover_image text, category_id uuid references public.blog_categories on delete set null, author_id uuid references public.users on delete set null, author_name text not null default 'Zaane Studio', status public.publish_status not null default 'draft', published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.projects (id uuid primary key default gen_random_uuid(), title text not null, slug text unique not null, category text not null, sub_category text not null default '', industry_tag text not null default '', cover_image text, short_description text not null default '', goal text not null default '', what_was_achieved text not null default '', tools_used text[] not null default '{}', satisfaction_rate integer check(satisfaction_rate between 0 and 100), client_name text not null default '', status public.publish_status not null default 'draft', featured boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.project_images (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete cascade, image_url text not null, "order" integer not null default 0, created_at timestamptz not null default now());
create table public.testimonials (id uuid primary key default gen_random_uuid(), client_name text not null, client_role text not null default '', quote text not null, rating integer not null default 5 check(rating between 1 and 5), photo_url text, project_id uuid references public.projects on delete set null, status public.publish_status not null default 'draft', created_at timestamptz not null default now());
create table public.team_members (id uuid primary key default gen_random_uuid(), name text not null, role text not null, bio text not null default '', photo_url text, "order" integer not null default 0, status public.publish_status not null default 'draft', created_at timestamptz not null default now());
create table public.leads (id uuid primary key default gen_random_uuid(), name text not null, email text not null, company text not null default '', service_interested text not null, budget_range text not null default '', message text not null, status text not null default 'new' check(status in ('new','contacted','qualified','won','lost')), created_at timestamptz not null default now());
create table public.contact_submissions (id uuid primary key default gen_random_uuid(), name text not null, email text not null, subject text not null, message text not null, status text not null default 'new' check(status in ('new','in_progress','resolved')), created_at timestamptz not null default now());
create table public.pages_content (id uuid primary key default gen_random_uuid(), page_key text not null, section_key text not null, content text not null, updated_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(page_key,section_key));
create table public.settings (id uuid primary key default gen_random_uuid(), key text unique not null, value text not null, created_at timestamptz not null default now());
create table public.resources (id uuid primary key default gen_random_uuid(), title text not null, description text not null default '', category text not null, download_url text not null, status public.publish_status not null default 'draft', created_at timestamptz not null default now());
create table public.jobs (id uuid primary key default gen_random_uuid(), title text not null, location text not null default 'Remote', employment_type text not null default 'Contract', description text not null, status public.publish_status not null default 'draft', created_at timestamptz not null default now());
create table public.subscribers (id uuid primary key default gen_random_uuid(), email text unique not null, consent_at timestamptz not null default now(), created_at timestamptz not null default now());
create table public.rate_limits (key text primary key, hits integer not null, expires_at timestamptz not null);
create function public.consume_rate_limit(bucket text) returns boolean language plpgsql security definer set search_path = '' as $$ declare n integer; begin delete from public.rate_limits where expires_at < now(); insert into public.rate_limits values(bucket,1,now()+interval '1 hour') on conflict(key) do update set hits=public.rate_limits.hits+1 returning hits into n; return n <= 5; end $$;
revoke all on function public.consume_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text) to service_role;
create function public.touch_updated() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end $$;
create trigger blog_updated before update on public.blog_posts for each row execute function public.touch_updated();
create trigger project_updated before update on public.projects for each row execute function public.touch_updated();
create trigger page_updated before update on public.pages_content for each row execute function public.touch_updated();
alter table public.users enable row level security;
create policy own_profile on public.users for select to authenticated using (id=auth.uid() or public.staff_role()='super_admin');
create policy super_manage_users on public.users for update to authenticated using (public.staff_role()='super_admin') with check(public.staff_role()='super_admin');
-- Editor drafts cannot be published, and editors cannot mutate published content.
do $$ declare t text; begin
foreach t in array array['blog_posts','projects','testimonials','team_members','resources','jobs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy public_read on public.%I for select to anon,authenticated using(status=''published'' or public.staff_role() in (''super_admin'',''admin'',''editor''))',t);
 execute format('create policy staff_insert on public.%I for insert to authenticated with check(public.staff_role() in (''super_admin'',''admin'') or (public.staff_role()=''editor'' and status in (''draft'',''review'')))',t);
 execute format('create policy staff_update on public.%I for update to authenticated using(public.staff_role() in (''super_admin'',''admin'') or (public.staff_role()=''editor'' and status in (''draft'',''review''))) with check(public.staff_role() in (''super_admin'',''admin'') or (public.staff_role()=''editor'' and status in (''draft'',''review'')))',t);
 execute format('create policy staff_delete on public.%I for delete to authenticated using(public.staff_role() in (''super_admin'',''admin''))',t);
end loop;
foreach t in array array['leads','contact_submissions','subscribers'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy management on public.%I for all to authenticated using(public.staff_role() in (''super_admin'',''admin'')) with check(public.staff_role() in (''super_admin'',''admin''))',t);
end loop;
foreach t in array array['blog_categories','pages_content','settings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy public_read on public.%I for select to anon,authenticated using(true)',t);
 execute format('create policy management on public.%I for all to authenticated using(public.staff_role() in (%s)) with check(public.staff_role() in (%s))',t,case when t='settings' then '''super_admin''' else '''super_admin'',''admin''' end,case when t='settings' then '''super_admin''' else '''super_admin'',''admin''' end);
end loop; end $$;
alter table public.project_images enable row level security;
create policy image_read on public.project_images for select to anon,authenticated using(exists(select 1 from public.projects where id=project_id));
create policy image_manage on public.project_images for all to authenticated using(public.staff_role() in ('super_admin','admin') or (public.staff_role()='editor' and exists(select 1 from public.projects where id=project_id and status in ('draft','review')))) with check(public.staff_role() in ('super_admin','admin') or (public.staff_role()='editor' and exists(select 1 from public.projects where id=project_id and status in ('draft','review'))));
alter table public.rate_limits enable row level security;
create index blog_status on public.blog_posts(status,published_at desc);
create index project_status on public.projects(status,created_at desc);
create index project_image_parent on public.project_images(project_id);
create index leads_created on public.leads(created_at desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('media','media',true,5242880,array['image/jpeg','image/png','image/webp','image/avif']);
create policy media_read on storage.objects for select to anon,authenticated using(bucket_id='media');
create policy media_insert on storage.objects for insert to authenticated with check(bucket_id='media' and public.staff_role() in ('super_admin','admin','editor'));
create policy media_delete on storage.objects for delete to authenticated using(bucket_id='media' and public.staff_role() in ('super_admin','admin'));
insert into public.blog_categories(name,slug) values ('Design & Branding','design-branding'),('Web & App Development','development'),('MVP & Startups','mvp-startups'),('Case Studies','case-studies'),('Industry Insights','industry-insights'),('Agency Life / Behind the Scenes','agency-life');
commit;
