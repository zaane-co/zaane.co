import {notFound} from 'next/navigation';
import {staff,serviceClient} from '@/lib/supabase/server';
import StaffPage,{type Member} from '@/components/admin/StaffPage';
export default async function Page(){
 const me=await staff();if(me?.role!=='super_admin')notFound();
 const db=serviceClient();
 const [{data:rows},{data:auth},{data:zarn}]=await Promise.all([db.from('users').select('id,email,name,role,created_at').order('created_at'),db.auth.admin.listUsers({perPage:1000}),db.from('zarn_members').select('user_id,account_type,joined_at,deactivated_at')]);
 const seen=new Map((auth?.users??[]).map(u=>[u.id,u.last_sign_in_at??null]));
 // ZARN access per person: their account type, and whether they've joined or been deactivated.
 const chat=new Map((zarn??[]).map(z=>[z.user_id,{type:z.account_type as 'member'|'guest',state:(z.deactivated_at?'deactivated':z.joined_at?'active':'pending') as 'active'|'pending'|'deactivated'}]));
 const members:Member[]=(rows??[]).map(r=>({...r,role:r.role??null,last_sign_in_at:seen.get(r.id)??null,zarn:chat.get(r.id)??null}));
 return <StaffPage members={members} me={me.id}/>;
}
