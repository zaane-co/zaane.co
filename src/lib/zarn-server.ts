import 'server-only';
import {sessionClient,configured} from '@/lib/supabase/server';
import type {ZMember} from '@/lib/zarn';
// The signed-in ZARN member (active), plus their staff role if they also have admin access.
export async function zarnMember(){
 if(!configured())return null;
 const db=await sessionClient();
 const {data:{user}}=await db.auth.getUser();if(!user)return null;
 const [{data:m},{data:s}]=await Promise.all([
  db.from('zarn_members').select('*').eq('user_id',user.id).maybeSingle(),
  db.from('users').select('role').eq('id',user.id).maybeSingle(),
 ]);
 if(!m||m.deactivated_at||(m.expires_at&&new Date(m.expires_at)<=new Date()))return null;
 return {...(m as ZMember),staffRole:(s?.role as string|null)??null,db};
}
