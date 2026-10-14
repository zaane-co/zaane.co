import {staff} from '@/lib/supabase/server';
import {isAdmin} from '@/lib/cms';
import {filesGet,filesPost} from '@/lib/lead-files';
// Lead files in the Studio admin: admins and sales manage them, finance can download.
async function check(write:boolean){
 const me=await staff();if(!me)return null;
 const ok=['super_admin','admin','sales'].includes(me.role)||(!write&&me.role==='finance');
 return ok?{userId:me.id,canDelete:(by:string|null)=>isAdmin(me.role)||by===me.id}:null;
}
export const POST=(r:Request)=>filesPost(r,()=>check(true));
export const GET=(r:Request)=>filesGet(r,()=>check(false));
