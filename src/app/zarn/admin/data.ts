import 'server-only';
import {notFound} from 'next/navigation';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
// ZARN admin is for members marked as ZARN admin (and the Studio super admin). Studio roles alone don't count.
export async function zarnAdmin(){
 const m=await zarnMember();if(!m?.zarnAdmin)notFound();
 return {me:{id:m.user_id,name:m.display_name,email:m.email,role:m.staffRole},db:serviceClient()};
}
