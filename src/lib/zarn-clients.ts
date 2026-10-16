import 'server-only';
import {serviceClient} from '@/lib/supabase/server';
import type {zarnMember} from '@/lib/zarn-server';
type Me=NonNullable<Awaited<ReturnType<typeof zarnMember>>>;
// Who can do what with client spaces.
export const isStudioAdmin=(me:Me)=>me.staffRole==='super_admin'||me.staffRole==='admin';
export const canAddClients=(me:Me)=>me.account_type!=='guest'&&(isStudioAdmin(me)||me.staffRole==='sales');
export const canManageTeams=(me:Me)=>isStudioAdmin(me)||me.staffRole==='sales';
// Anything to do with money is for admins only in ZARN. Sales and finance staff use the Studio admin for invoices.
export const canSeeInvoices=(me:Me)=>isStudioAdmin(me);
// The client's space, and whether this member may work in it (on the team, or a Studio admin).
export async function clientAccess(me:Me,leadId:string){
 const db=serviceClient();
 const {data:ch}=await db.from('zarn_channels').select('id,archived_at').eq('kind','client').eq('lead_id',leadId).maybeSingle();
 if(!ch)return {db,channel:null,allowed:false};
 const {data:onTeam}=await db.from('zarn_channel_members').select('user_id').eq('channel_id',ch.id).eq('user_id',me.user_id).maybeSingle();
 return {db,channel:ch,allowed:!!onTeam||isStudioAdmin(me)};
}
