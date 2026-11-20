import 'server-only';
import {headers} from 'next/headers';
import {serviceClient} from '@/lib/supabase/server';
import {bankColumns,type BankAccount} from '@/lib/bank';
// What the invoice editor needs besides the invoice itself.
export async function editorData(){
 const db=serviceClient(),h=await headers();
 const [{data:clients},{data:accounts}]=await Promise.all([
  db.from('zarn_biz_contacts').select('id,name,company,email').order('name'),
  db.from('bank_accounts').select(bankColumns).order('created_at'),
 ]);
 return {clients:clients??[],accounts:(accounts??[]) as BankAccount[],emailReady:!!process.env.RESEND_API_KEY&&!!(process.env.CRM_FROM_EMAIL||process.env.LEAD_NOTIFICATION_EMAIL),origin:`${h.get('x-forwarded-proto')??'https'}://${h.get('host')}`};
}
