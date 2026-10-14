import ZarnMembers,{type Row} from '@/components/admin/zarn/ZarnMembers';
import {zarnAdmin} from './data';
export default async function Page(){
 const {me,db}=await zarnAdmin();
 const [{data:members,error},{data:auth},{data:staffRows}]=await Promise.all([
  db.from('zarn_members').select('*').order('created_at'),
  db.auth.admin.listUsers({perPage:1000}),
  db.from('users').select('id,role'),
 ]);
 if(error)return <div className="za-page"><div className="za-notice">ZARN isn’t set up yet. Apply the 202610150001_zarn migration.</div></div>;
 const seen=new Map((auth?.users??[]).map(u=>[u.id,u.last_sign_in_at??null]));
 const roles=new Map((staffRows??[]).map(r=>[r.id,r.role as string|null]));
 const rows:Row[]=(members??[]).map(m=>({...m,last_sign_in_at:seen.get(m.user_id)??null,staff_role:roles.get(m.user_id)??null}));
 return <ZarnMembers rows={rows} me={{id:me.id,name:me.name,email:me.email}}/>;
}
