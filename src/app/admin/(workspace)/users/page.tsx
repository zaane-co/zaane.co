import {notFound} from 'next/navigation';
import {staff,serviceClient} from '@/lib/supabase/server';
import StaffPage,{type Member} from '@/components/admin/StaffPage';
export default async function Page(){
 const me=await staff();if(me?.role!=='super_admin')notFound();
 const db=serviceClient();
 const [{data:rows},{data:auth}]=await Promise.all([db.from('users').select('id,email,name,role,created_at').order('created_at'),db.auth.admin.listUsers({perPage:1000})]);
 const seen=new Map((auth?.users??[]).map(u=>[u.id,u.last_sign_in_at??null]));
 const members:Member[]=(rows??[]).map(r=>({...r,role:r.role??null,last_sign_in_at:seen.get(r.id)??null}));
 return <StaffPage members={members} me={me.id}/>;
}
