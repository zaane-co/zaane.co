import {notFound,redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import {canManageTeams,canSeeInvoices,clientAccess} from '@/lib/zarn-clients';
import ClientSpace,{type SpaceData} from '@/components/zarn/ClientSpace';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// One client's space. Only its team and Studio admins get past the access check; everyone else gets a 404.
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.test(id))notFound();
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 const {db,channel,allowed}=await clientAccess(me,id);
 if(!channel||!allowed)notFound();
 const [{data:lead},{data:stages},{data:team},{data:tasks},{data:materials},{data:activities},invoices,{data:staff},{data:files}]=await Promise.all([
  db.from('leads').select('id,name,company,email,phone,website,service_interested,budget_range,message,project_description,status,deal_value,currency,categories,owner_id,created_at,last_activity_at').eq('id',id).single(),
  db.from('pipeline_stages').select('key,label,color,kind,position'),
  db.from('zarn_channel_members').select('user_id').eq('channel_id',channel.id),
  db.from('lead_tasks').select('id,title,due_at,done_at,assignee_id,created_at').eq('lead_id',id).order('done_at',{nullsFirst:true}).order('due_at',{nullsFirst:false}),
  db.from('lead_materials').select('id,title,note,link,file_key,file_name,received_at').eq('lead_id',id).order('position'),
  db.from('lead_activities').select('id,kind,body,meta,author_id,created_at').eq('lead_id',id).order('created_at',{ascending:false}).limit(60),
  canSeeInvoices(me)?db.from('invoices').select('id,number,status,total,amount_paid,currency,due_date').eq('lead_id',id).order('created_at',{ascending:false}):Promise.resolve({data:null}),
  db.from('users').select('id,name,email'),
  db.from('lead_files').select('id,name,size,type,uploaded_by,created_at').eq('lead_id',id).order('created_at',{ascending:false}),
 ]);
 if(!lead)notFound();
 const data:SpaceData={files:files??[],me:me.user_id,lead,channelId:channel.id,stages:(stages??[]).sort((a,b)=>(a.kind==='lost'?1:0)-(b.kind==='lost'?1:0)||a.position-b.position),team:(team??[]).map(t=>t.user_id),tasks:tasks??[],materials:materials??[],activities:activities??[],invoices:invoices.data,names:Object.fromEntries((staff??[]).map(u=>[u.id,u.name||u.email])),canManage:canManageTeams(me),canStudio:me.staffRole==='super_admin'||me.staffRole==='admin'||me.staffRole==='sales'};
 return <ClientSpace key={id} data={data}/>;
}
