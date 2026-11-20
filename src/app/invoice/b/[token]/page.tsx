import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {serviceClient} from '@/lib/supabase/server';
import {settings} from '@/lib/content';
import InvoiceDocument,{type InvoiceClient} from '@/components/invoice/InvoiceDocument';
import type {Invoice} from '@/lib/crm';
import {bankColumns,type BankAccount} from '@/lib/bank';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Invoice | Zaane',robots:{index:false,follow:false}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A ZARN Business invoice as the customer sees it. The unguessable token is the only key; drafts are never shown.
export default async function Page({params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!uuid.test(token))notFound();
 const db=serviceClient();
 const [{data},{data:accounts}]=await Promise.all([db.from('zarn_biz_invoices').select('*,zarn_biz_contacts(name,email,company,phone)').eq('public_token',token).neq('status','draft').maybeSingle(),db.from('bank_accounts').select(bankColumns)]);
 if(!data)notFound();
 return <InvoiceDocument inv={data as unknown as Invoice} client={data.zarn_biz_contacts as unknown as InvoiceClient} settings={await settings()} accounts={(accounts??[]) as BankAccount[]}/>;
}
