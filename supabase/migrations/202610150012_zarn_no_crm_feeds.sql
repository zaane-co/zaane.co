-- ZARN channels are for conversations only. CRM and invoice activity lives under Clients, not in channels.
drop trigger if exists zarn_lead_events on public.leads;
drop trigger if exists zarn_invoice_events on public.invoices;
drop function if exists public.zarn_lead_events();
drop function if exists public.zarn_invoice_events();
drop function if exists public.zarn_crm_post(text,uuid,uuid,jsonb);
-- Archive (not delete) the two starter channels that existed only to receive those posts.
update public.zarn_channels set crm_feed=null,archived_at=coalesce(archived_at,now()) where crm_feed is not null;
