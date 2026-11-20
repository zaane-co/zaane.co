import {redirect} from 'next/navigation';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import BusinessOverview,{type Overview} from '@/components/zarn/BusinessOverview';
export const dynamic='force-dynamic';
const dates=()=>{const n=Date.now(),d=(ms:number)=>new Date(n+ms).toISOString();return {month:d(0).slice(0,8)+'01',soon:d(7*864e5).slice(0,10),weekAgo:d(-7*864e5),today:d(0).slice(0,10)};};
// Business home: pipeline numbers, my clients and the tasks assigned to me across clients.
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 const admin=me.zarnAdmin;
 if(me.account_type==='guest'||!admin)redirect('/zarn');
 const db=serviceClient();
 const [{data:leads},{data:spaces},{data:mine},{data:tasks}]=await Promise.all([
  me.db.from('zarn_leads').select('id,name,company,status,stage_label,stage_color,stage_kind,deal_value,currency,last_activity_at'),
  db.from('zarn_channels').select('id,lead_id').eq('kind','client').is('archived_at',null),
  db.from('zarn_channel_members').select('channel_id').eq('user_id',me.user_id),
  db.from('lead_tasks').select('id,lead_id,title,due_at').eq('assignee_id',me.user_id).is('done_at',null).order('due_at',{nullsFirst:false}).limit(30),
 ]);
 const {month,soon,weekAgo,today}=dates();
 const [{data:ent},{data:pays},{data:owed},{data:bills},{count:newLeads}]=await Promise.all([
  db.from('zarn_client_receipts').select('direction,amount,currency,invoice_id').gte('paid_on',month),
  db.from('invoice_payments').select('amount,invoice_id,invoices(currency)').gte('paid_on',month),
  db.from('invoices').select('total,amount_paid,currency,due_date').eq('status','sent'),
  db.from('zarn_bills').select('id,title,amount,currency,due_on').not('due_on','is',null).lte('due_on',soon).order('due_on').limit(8),
  db.from('leads').select('id',{count:'exact',head:true}).gte('created_at',weekAgo),
 ]);
 const paid=new Set((pays??[]).map(p=>p.invoice_id));
 const money={in:[...(pays??[]).map(p=>({amount:Number(p.amount),currency:(p.invoices as unknown as {currency:string}|null)?.currency??'NGN'})),...(ent??[]).filter(e=>e.direction==='in'&&!(e.invoice_id&&paid.has(e.invoice_id))).map(e=>({amount:Number(e.amount),currency:e.currency}))],
  out:(ent??[]).filter(e=>e.direction==='out').map(e=>({amount:Number(e.amount),currency:e.currency})),
  owed:(owed??[]).map(i=>({amount:Number(i.total)-Number(i.amount_paid),currency:i.currency,late:i.due_date<today})),
  bills:(bills??[]) as {id:string;title:string;amount:number;currency:string;due_on:string}[],newLeads:newLeads??0};
 const myChannels=new Set((mine??[]).map(m=>m.channel_id));
 const myLeadIds=new Set((spaces??[]).filter(s=>myChannels.has(s.id)).map(s=>s.lead_id));
 const spaceLeadIds=new Set((spaces??[]).map(s=>s.lead_id));
 const data:Overview={leads:(leads??[]) as Overview['leads'],myLeadIds:[...myLeadIds] as string[],spaceLeadIds:[...spaceLeadIds] as string[],tasks:tasks??[],money};
 return <BusinessOverview data={data}/>;
}
