-- Two more staff roles: sales (CRM, contacts, subscribers) and finance (invoices, payments).
-- Policies compare staff_role() as text, so the new enum values aren't used inside this transaction.
alter type public.staff_role add value if not exists 'sales';
alter type public.staff_role add value if not exists 'finance';

do $$ declare t text; begin
-- Sales runs the CRM and the inboxes.
foreach t in array array['leads','lead_activities','lead_tasks','lead_materials','lead_categories','pipeline_stages','contact_submissions','subscribers'] loop
 execute format('create policy sales_manage on public.%I for all to authenticated using(public.staff_role()=''sales'') with check(public.staff_role()=''sales'')',t);
end loop;
-- Finance owns invoices and payments; sales can see them on a client's page but not change them.
foreach t in array array['invoices','invoice_payments'] loop
 execute format('create policy finance_manage on public.%I for all to authenticated using(public.staff_role()=''finance'') with check(public.staff_role()=''finance'')',t);
 execute format('create policy sales_read on public.%I for select to authenticated using(public.staff_role()=''sales'')',t);
end loop; end $$;

-- Finance needs client records to bill: read clients, add a new client from the invoice dialog, log invoice emails/payments.
create policy finance_read on public.leads for select to authenticated using(public.staff_role()='finance');
create policy finance_insert on public.leads for insert to authenticated with check(public.staff_role()='finance');
create policy finance_read on public.pipeline_stages for select to authenticated using(public.staff_role()='finance');
create policy finance_log on public.lead_activities for insert to authenticated with check(public.staff_role()='finance');
