import {notFound,redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {settings} from '@/lib/content';
import InvoiceDocument,{type InvoiceClient} from '@/components/invoice/InvoiceDocument';
import type {Invoice} from '@/lib/crm';
import {bankColumns,type BankAccount} from '@/lib/bank';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Print invoice | Zaane',robots:{index:false,follow:false}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Staff print view: same document as the client sees, but works for drafts too (marked DRAFT).
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{print?:string}>}){
 const {id}=await params;if(!uuid.test(id))notFound();
 const user=await staff();if(!user)redirect('/admin/login');if(!allowed('invoices',user.role))notFound();
 const {data}=await (await sessionClient()).from('invoices').select('*,leads(name,email,company,phone)').eq('id',id).maybeSingle();
 if(!data)notFound();
 return <InvoiceDocument inv={data as Invoice} client={data.leads as unknown as InvoiceClient} settings={await settings()} accounts={((await (await sessionClient()).from('bank_accounts').select(bankColumns)).data??[]) as BankAccount[]} autoPrint={(await searchParams).print==='1'} back={`/admin/invoices/${id}`}/>;
}
