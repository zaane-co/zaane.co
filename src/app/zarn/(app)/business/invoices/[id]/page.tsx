import {notFound,redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import {serviceClient} from '@/lib/supabase/server';
import {InvoiceEditor} from '@/components/zarn/BizInvoices';
import type {Invoice,Payment} from '@/lib/crm';
import {editorData} from '../data';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.test(id))notFound();
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(me.account_type==='guest'||!me.zarnAdmin)redirect('/zarn');
 const db=serviceClient();
 const [{data:invoice},{data:payments},rest]=await Promise.all([
  db.from('invoices').select('*').eq('id',id).maybeSingle(),
  db.from('invoice_payments').select('*').eq('invoice_id',id).order('paid_on',{ascending:false}),
  editorData(),
 ]);
 if(!invoice)notFound();
 return <InvoiceEditor key={`${invoice.id}-${invoice.updated_at}`} invoice={invoice as Invoice} payments={(payments??[]) as Payment[]} {...rest}/>;
}
