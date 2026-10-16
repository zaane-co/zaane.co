import {redirect} from 'next/navigation';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import AllClients,{type ClientRow} from '@/components/zarn/AllClients';
export const dynamic='force-dynamic';
// Every client with a space: stage, value, team size, open tasks. Opening one requires being on its team (or admin).
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 const admin=me.staffRole==='super_admin'||me.staffRole==='admin';
 if(me.account_type==='guest'||!admin)redirect('/zarn');
 const db=serviceClient();
 const [{data:spaces},{data:links},{data:tasks},{data:stages}]=await Promise.all([
  db.from('zarn_channels').select('id,lead_id,archived_at,leads(id,name,company,status,deal_value,currency,last_activity_at)').eq('kind','client'),
  db.from('zarn_channel_members').select('channel_id,user_id'),
  db.from('lead_tasks').select('lead_id').is('done_at',null),
  db.from('pipeline_stages').select('key,label,color'),
 ]);
 const stageBy=Object.fromEntries((stages??[]).map(s=>[s.key,s]));
 const rows:ClientRow[]=(spaces??[]).filter(s=>!s.archived_at&&s.leads).map(s=>{const l=s.leads as unknown as {id:string;name:string;company:string;status:string;deal_value:number|null;currency:string;last_activity_at:string};const team=(links??[]).filter(x=>x.channel_id===s.id).map(x=>x.user_id);
  return {lead_id:l.id,name:l.company||l.name,contact:l.company?l.name:'',stage:stageBy[l.status]?.label??l.status,color:stageBy[l.status]?.color??'#52525b',value:l.deal_value,currency:l.currency,team,openTasks:(tasks??[]).filter(t=>t.lead_id===l.id).length,last:l.last_activity_at,canOpen:admin||team.includes(me.user_id)};});
 return <AllClients rows={rows}/>;
}
