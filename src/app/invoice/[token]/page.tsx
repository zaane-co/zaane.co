import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {serviceClient} from '@/lib/supabase/server';
import {settings} from '@/lib/content';
import InvoiceDocument,{type InvoiceClient} from '@/components/invoice/InvoiceDocument';
import type {Invoice} from '@/lib/crm';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Invoice | Zaane',robots:{index:false,follow:false}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Client-facing invoice. The unguessable public_token is the only key; drafts are never shown.
export default async function Page({params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!uuid.test(token))notFound();
 const {data}=await serviceClient().from('invoices').select('*,leads(name,email,company,phone)').eq('public_token',token).neq('status','draft').maybeSingle();
 if(!data)notFound();
 return <InvoiceDocument inv={data as Invoice} client={data.leads as unknown as InvoiceClient} settings={await settings()}/>;
}
