-- Cached link previews (title, description, image) for links shared in chat. Written and read by the server only.
create table public.zarn_link_previews (
 url text primary key,
 title text not null default '',
 description text not null default '',
 image text not null default '',
 site text not null default '',
 fetched_at timestamptz not null default now()
);
alter table public.zarn_link_previews enable row level security;
