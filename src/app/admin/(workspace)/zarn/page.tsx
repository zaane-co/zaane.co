import ZarnMembers,{type Row,type ChannelOpt} from '@/components/admin/zarn/ZarnMembers';
import {zarnAdmin} from './data';
export default async function Page(){
 const {me,db}=await zarnAdmin();
 const [{data:members,error},{data:auth},{data:staffRows},{data:channels},{data:links}]=await Promise.all([
  db.from('zarn_members').select('*').order('created_at'),
  db.auth.admin.listUsers({perPage:1000}),
  db.from('users').select('id,role'),
  db.from('zarn_channels').select('id,name,kind,is_default,crm_feed').in('kind',['public','private']).is('archived_at',null).order('name'),
  db.from('zarn_channel_members').select('channel_id,user_id'),
 ]);
 if(error)return <div className="za-page"><div className="za-notice">ZARN isn’t set up yet. Apply the ZARN migrations.</div></div>;
 const seen=new Map((auth?.users??[]).map(u=>[u.id,u.last_sign_in_at??null]));
 const roles=new Map((staffRows??[]).map(r=>[r.id,r.role as string|null]));
 const chIds=new Set((channels??[]).map(c=>c.id));
 const byUser=(links??[]).reduce<Record<string,string[]>>((m,l)=>{if(chIds.has(l.channel_id))(m[l.user_id]??=[]).push(l.channel_id);return m;},{});
 const rows:Row[]=(members??[]).map(m=>({...m,last_sign_in_at:seen.get(m.user_id)??null,staff_role:roles.get(m.user_id)??null,channel_ids:byUser[m.user_id]??[]}));
 return <ZarnMembers rows={rows} channels={(channels??[]) as ChannelOpt[]} me={{id:me.id,name:me.name,email:me.email}}/>;
}
