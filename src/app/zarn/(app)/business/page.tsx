import {redirect} from 'next/navigation';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import BusinessOverview,{type Overview} from '@/components/zarn/BusinessOverview';
export const dynamic='force-dynamic';
const dates=()=>{const n=Date.now(),d=(ms:number)=>new Date(n+ms).toISOString();return {month:d(0).slice(0,8)+'01',soon:d(7*864e5).slice(0,10),weekAgo:d(-7*864e5),today:d(0).slice(0,10)};};
// Business home: money this month, what's owed, new leads and bills coming up. Separate from Clients.
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(me.account_type==='guest'||!me.zarnAdmin)redirect('/zarn');
 const db=serviceClient(),{month,soon,weekAgo,today}=dates();
 const [{data:ent},{data:pays},{data:owed},{data:bills},{data:leads}]=await Promise.all([
  db.from('zarn_biz_entries').select('direction,amount,currency').gte('paid_on',month),
  db.from('zarn_biz_payments').select('amount,zarn_biz_invoices(currency)').gte('paid_on',month),
  db.from('zarn_biz_invoices').select('id,number,total,amount_paid,currency,due_date,zarn_biz_contacts(name,company)').eq('status','sent').order('due_date'),
  db.from('zarn_bills').select('id,title,amount,currency,due_on').not('due_on','is',null).lte('due_on',soon).order('due_on').limit(8),
  db.from('zarn_biz_contacts').select('id,name,company,stage,created_at').in('stage',['new','contacted','proposal']).order('created_at',{ascending:false}).limit(200),
 ]);
 const data:Overview={today,
  in:[...(pays??[]).map(p=>({amount:Number(p.amount),currency:(p.zarn_biz_invoices as unknown as {currency:string}|null)?.currency??'NGN'})),...(ent??[]).filter(e=>e.direction==='in').map(e=>({amount:Number(e.amount),currency:e.currency}))],
  out:(ent??[]).filter(e=>e.direction==='out').map(e=>({amount:Number(e.amount),currency:e.currency})),
  owed:(owed??[]).map(i=>{const c=i.zarn_biz_contacts as unknown as {name:string;company:string}|null;return {id:i.id,number:i.number,who:c?.company||c?.name||'',amount:Number(i.total)-Number(i.amount_paid),currency:i.currency,due:i.due_date};}),
  bills:(bills??[]) as Overview['bills'],
  leads:(leads??[]).map(l=>({id:l.id,name:l.company||l.name,stage:l.stage,created_at:l.created_at})),
  weekAgo};
 return <BusinessOverview data={data}/>;
}
