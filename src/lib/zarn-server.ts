import 'server-only';
import {sessionClient,currentUserId} from '@/lib/supabase/server';
import {cache} from 'react';
import type {ZMember} from '@/lib/zarn';
// The signed-in ZARN member (active), plus their staff role if they also have admin access.
// Shared by the ZARN layout and page within one request; identity comes from the locally verified session JWT.
export const zarnMember=cache(async()=>{
 const id=await currentUserId();if(!id)return null;
 const db=await sessionClient();
 const user={id};
 const [{data:m},{data:s}]=await Promise.all([
  db.from('zarn_members').select('*').eq('user_id',user.id).maybeSingle(),
  db.from('users').select('role').eq('id',user.id).maybeSingle(),
 ]);
 if(!m||m.deactivated_at||(m.expires_at&&new Date(m.expires_at)<=new Date()))return null;
 return {...(m as ZMember),staffRole:(s?.role as string|null)??null,db};
});
