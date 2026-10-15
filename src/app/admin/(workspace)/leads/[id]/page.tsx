import {serviceClient} from '@/lib/supabase/server';
import {notFound} from 'next/navigation';
import LeadDetail from '@/components/admin/crm/LeadDetail';
import type {Activity,Invoice,Lead,Material,Task} from '@/lib/crm';
import {crmAccess,loadStages,staffList} from '../data';
import {allowed} from '@/lib/cms';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{section?:string}>}){
 const {id}=await params;const {section}=await searchParams;if(!uuid.test(id))notFound();
 const {db,user}=await crmAccess();
 const [{data:lead},{data:activities},{data:tasks},team,stages,{data:cats},{data:materials},{data:invoices},{data:files},{data:space}]=await Promise.all([
  db.from('leads').select('*').eq('id',id).maybeSingle(),
  db.from('lead_activities').select('*').eq('lead_id',id).order('created_at',{ascending:false}).limit(500),
  db.from('lead_tasks').select('*').eq('lead_id',id).order('done_at',{nullsFirst:true}).order('due_at',{nullsFirst:false}),
  staffList(),
  loadStages(db),
  db.from('lead_categories').select('name').order('name'),
  db.from('lead_materials').select('*').eq('lead_id',id).order('position'),
  db.from('invoices').select('*').eq('lead_id',id).order('created_at',{ascending:false}),
  db.from('lead_files').select('id,name,size,type,uploaded_by,created_at').eq('lead_id',id).order('created_at',{ascending:false}),
  serviceClient().from('zarn_channels').select('id').eq('kind','client').eq('lead_id',id).maybeSingle(),
 ]);
 if(!lead)notFound();
 return <LeadDetail initialSection={section==='invoices'&&allowed('invoices',user.role)?'invoices':undefined} files={files??[]} hasSpace={!!space} canInvoice={allowed('invoices',user.role)} key={lead.id} stages={stages} categories={(cats??[]).map(c=>c.name)} materials={(materials??[]) as Material[]} invoices={(invoices??[]) as Invoice[]} lead={lead as Lead} activities={(activities??[]) as Activity[]} tasks={(tasks??[]) as Task[]} team={team} me={user.id} emailReady={!!process.env.RESEND_API_KEY&&!!(process.env.CRM_FROM_EMAIL||process.env.LEAD_NOTIFICATION_EMAIL)}/>;
}
