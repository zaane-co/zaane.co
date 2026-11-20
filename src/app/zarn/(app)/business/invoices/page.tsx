import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import {serviceClient} from '@/lib/supabase/server';
import {InvoiceList,type InvRow} from '@/components/zarn/BizInvoices';
export const dynamic='force-dynamic';
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(me.account_type==='guest'||!me.zarnAdmin)redirect('/zarn');
 const db=serviceClient(),month=new Date().toISOString().slice(0,8)+'01';
 const [{data},{data:pays}]=await Promise.all([
  db.from('zarn_biz_invoices').select('*,zarn_biz_contacts(name,company)').order('created_at',{ascending:false}).limit(1000),
  db.from('zarn_biz_payments').select('amount,zarn_biz_invoices(currency)').gte('paid_on',month),
 ]);
 const rows=(data??[]).map(r=>{const l=r.zarn_biz_contacts as unknown as {name:string;company:string}|null;return {...r,client:l?.company||l?.name||''} as InvRow;});
 return <InvoiceList invoices={rows} collected={(pays??[]).map(p=>({amount:Number(p.amount),currency:(p.zarn_biz_invoices as unknown as {currency:string}|null)?.currency??'NGN'}))}/>;
}
