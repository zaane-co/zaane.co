-- Reusable newsletter bodies. The outer frame (header, footer) is shared; a template is just the content.
create table if not exists public.newsletter_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 body text not null default '',
 created_by uuid references public.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.newsletter_templates enable row level security;
create policy management on public.newsletter_templates for all to authenticated
 using(public.staff_role() in ('super_admin','admin','sales')) with check(public.staff_role() in ('super_admin','admin','sales'));

insert into public.newsletter_templates(name,body) values
('Welcome','<h1>Welcome to Zaane</h1><p>Thanks for subscribing. You’re now on the list for practical insights on building and growing with technology, straight from the team behind the products we’re shipping.</p><p>Here’s what to expect:</p><ul><li>Product updates: what we’re building and what’s coming next</li><li>Practical playbooks on software, AI, and running a smarter business</li><li>Early access to new tools, launches, and offers</li></ul><p>One quick favor: reply to this email and tell us what you’re working on right now. We read every response.</p><p><a href="https://zaane.co" data-button="true">Visit zaane.co</a></p>'),
('Product update','<h1>What’s new at Zaane</h1><p>Here’s a quick look at what we shipped recently.</p><h2>The headline</h2><p>Describe the biggest update here in two or three sentences.</p><h2>Also new</h2><ul><li>First smaller update</li><li>Second smaller update</li><li>Third smaller update</li></ul><p><a href="https://zaane.co" data-button="true">See the details</a></p>'),
('Announcement','<h1>Big news</h1><p>Write the announcement in a sentence or two. Lead with what changes for the reader.</p><p>Add the context, the date, and what you’d like them to do next.</p><p><a href="https://zaane.co" data-button="true">Learn more</a></p><p>Thanks for being part of it.</p>');
