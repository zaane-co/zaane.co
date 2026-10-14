import {zarnMember} from '@/lib/zarn-server';
import {clientAccess,isStudioAdmin} from '@/lib/zarn-clients';
import {filesGet,filesPost} from '@/lib/lead-files';
// Lead files from a ZARN client space: anyone on the client's team (or a Studio admin).
async function check(leadId:string){
 const me=await zarnMember();if(!me)return null;
 const {allowed}=await clientAccess(me,leadId);
 return allowed?{userId:me.user_id,canDelete:(by:string|null)=>isStudioAdmin(me)||by===me.user_id}:null;
}
export const POST=(r:Request)=>filesPost(r,check);
export const GET=(r:Request)=>filesGet(r,check);
