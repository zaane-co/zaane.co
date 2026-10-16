-- A client's project brief can now be formatted text with links. (project_description keeps a plain-text copy for the Studio admin.)
alter table public.leads add column brief_html text not null default '' check (length(brief_html) <= 100000);
