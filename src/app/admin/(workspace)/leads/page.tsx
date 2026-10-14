import CrmBoard from '@/components/admin/crm/CrmBoard';
import type {Lead,Task} from '@/lib/crm';
import {crmAccess,loadStages,staffList} from './data';
export default async function Page({searchParams}:{searchParams:Promise<{new?:string}>}){
 const {db,user}=await crmAccess();
 const [{data:leads,error},{data:tasks},team,stages]=await Promise.all([
  db.from('leads').select('*').order('position').order('created_at',{ascending:false}).limit(2000),
  db.from('lead_tasks').select('id,lead_id,title,due_at,done_at,assignee_id,created_at').is('done_at',null).order('due_at',{ascending:true,nullsFirst:false}),
  staffList(),
  loadStages(db),
 ]);
 if(error)return <div className="za-page"><div className="za-page-head"><div><h1>Leads</h1></div></div><div className="za-notice" role="alert">Could not load the CRM. Check that the 202610140003_crm migration is applied.</div></div>;
 return <CrmBoard startNew={(await searchParams).new==='1'} stages={stages} leads={(leads??[]) as Lead[]} tasks={(tasks??[]) as Task[]} team={team} me={user.id}/>;
}
