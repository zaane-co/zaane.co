import {notFound,redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import {serviceClient} from '@/lib/supabase/server';
import {settings} from '@/lib/content';
import InvoiceDocument,{type InvoiceClient} from '@/components/invoice/InvoiceDocument';
import type {Invoice} from '@/lib/crm';
import {bankColumns,type BankAccount} from '@/lib/bank';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Print or save as PDF: the same document the customer sees, drafts included (marked Draft).
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.test(id))notFound();
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(me.account_type==='guest'||!me.zarnAdmin)redirect('/zarn');
 const db=serviceClient();
 const [{data},{data:accounts}]=await Promise.all([db.from('zarn_biz_invoices').select('*,zarn_biz_contacts(name,email,company,phone)').eq('id',id).maybeSingle(),db.from('bank_accounts').select(bankColumns)]);
 if(!data)notFound();
 return <InvoiceDocument inv={data as unknown as Invoice} client={data.zarn_biz_contacts as unknown as InvoiceClient} settings={await settings()} accounts={(accounts??[]) as BankAccount[]} autoPrint back={`/zarn/business/invoices/${id}`}/>;
}
