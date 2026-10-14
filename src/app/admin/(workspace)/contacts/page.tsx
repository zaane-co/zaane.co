import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import AddressBook,{type Person} from '@/components/admin/AddressBook';
export const dynamic='force-dynamic';
// One address book: every lead/client plus everyone from the contact inbox, merged by email.
export default async function Page(){
 const user=await staff();if(!user||!allowed('contact_submissions',user.role))notFound();
 const db=await sessionClient();
 const [{data:leads},{data:stages},{data:contacts}]=await Promise.all([
  db.from('leads').select('id,name,email,company,phone,status,service_interested,created_at,last_activity_at').order('last_activity_at',{ascending:false}).limit(5000),
  db.from('pipeline_stages').select('key,label,color,kind'),
  db.from('contact_submissions').select('id,name,email,phone,company,subject,source,status,created_at').order('created_at',{ascending:false}).limit(5000),
 ]);
 const stage=Object.fromEntries((stages??[]).map(s=>[s.key,s]));
 const byEmail=new Map<string,Person>();
 const keyOf=(email:string,fallback:string)=>(email||'').trim().toLowerCase()||`id:${fallback}`;
 for(const l of leads??[]){
  const s=stage[l.status],k=keyOf(l.email,l.id);
  byEmail.set(k,{key:k,name:l.name,email:l.email,phone:l.phone,company:l.company,types:[s?.kind==='won'?'client':'lead'],stage:s?{label:s.label,color:s.color}:null,detail:l.service_interested,href:`/admin/leads/${l.id}`,last:l.last_activity_at||l.created_at});
 }
 for(const c of contacts??[]){
  const k=keyOf(c.email,c.id),t=c.source==='manual'?'contact':'message',ex=byEmail.get(k);
  if(ex){if(!ex.types.includes(t))ex.types.push(t);ex.phone||=c.phone;ex.company||=c.company;if(c.created_at>ex.last)ex.last=c.created_at;continue;}
  byEmail.set(k,{key:k,name:c.name,email:c.email,phone:c.phone,company:c.company,types:[t],stage:null,detail:c.subject,href:`/admin/contact_submissions?open=${c.id}`,last:c.created_at});
 }
 return <AddressBook people={[...byEmail.values()].sort((a,b)=>b.last.localeCompare(a.last))}/>;
}
