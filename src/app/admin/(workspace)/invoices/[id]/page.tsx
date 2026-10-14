import {notFound} from 'next/navigation';
import InvoiceEditor from '@/components/admin/crm/InvoiceEditor';
import type {Invoice,Payment} from '@/lib/crm';
import {invoiceAccess} from '../../leads/data';
import {allowed} from '@/lib/cms';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.test(id))notFound();
 const {db,user}=await invoiceAccess();
 const [{data:invoice},{data:payments},{data:clients}]=await Promise.all([
  db.from('invoices').select('*').eq('id',id).maybeSingle(),
  db.from('invoice_payments').select('*').eq('invoice_id',id).order('paid_on',{ascending:false}),
  db.from('leads').select('id,name,company,email').order('name'),
 ]);
 if(!invoice)notFound();
 return <InvoiceEditor canCrm={allowed('leads',user.role)} key={`${invoice.id}-${invoice.updated_at}`} invoice={invoice as Invoice} payments={(payments??[]) as Payment[]} clients={clients??[]} emailReady={!!process.env.RESEND_API_KEY&&!!(process.env.CRM_FROM_EMAIL||process.env.LEAD_NOTIFICATION_EMAIL)}/>;
}
