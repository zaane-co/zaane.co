-- Newsletter (campaigns + subscribers) belongs to editors, not sales. Sales keeps the CRM.
drop policy if exists sales_manage on public.subscribers;
create policy editor_manage on public.subscribers for all to authenticated using(public.staff_role()='editor') with check(public.staff_role()='editor');
drop policy if exists management on public.newsletter_campaigns;
create policy management on public.newsletter_campaigns for all to authenticated
 using(public.staff_role() in ('super_admin','admin','editor')) with check(public.staff_role() in ('super_admin','admin','editor'));
drop policy if exists management on public.newsletter_templates;
create policy management on public.newsletter_templates for all to authenticated
 using(public.staff_role() in ('super_admin','admin','editor')) with check(public.staff_role() in ('super_admin','admin','editor'));
