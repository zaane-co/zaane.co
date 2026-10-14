import {redirect} from 'next/navigation';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import BusinessOverview,{type Overview} from '@/components/zarn/BusinessOverview';
export const dynamic='force-dynamic';
// Business home: pipeline numbers, my clients and the tasks assigned to me across clients.
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 const admin=me.staffRole==='super_admin'||me.staffRole==='admin';
 if(me.account_type==='guest'||(!me.can_view_crm&&!admin))redirect('/zarn');
 const db=serviceClient();
 const [{data:leads},{data:spaces},{data:mine},{data:tasks}]=await Promise.all([
  me.db.from('zarn_leads').select('id,name,company,status,stage_label,stage_color,stage_kind,deal_value,currency,last_activity_at'),
  db.from('zarn_channels').select('id,lead_id').eq('kind','client').is('archived_at',null),
  db.from('zarn_channel_members').select('channel_id').eq('user_id',me.user_id),
  db.from('lead_tasks').select('id,lead_id,title,due_at').eq('assignee_id',me.user_id).is('done_at',null).order('due_at',{nullsFirst:false}).limit(30),
 ]);
 const myChannels=new Set((mine??[]).map(m=>m.channel_id));
 const myLeadIds=new Set((spaces??[]).filter(s=>myChannels.has(s.id)).map(s=>s.lead_id));
 const spaceLeadIds=new Set((spaces??[]).map(s=>s.lead_id));
 const data:Overview={leads:(leads??[]) as Overview['leads'],myLeadIds:[...myLeadIds] as string[],spaceLeadIds:[...spaceLeadIds] as string[],tasks:tasks??[]};
 return <BusinessOverview data={data}/>;
}
