import 'server-only';
import {cookies} from 'next/headers';
import {serviceClient} from '@/lib/supabase/server';
import {cookieName,verifyUnlock} from '@/lib/doc-share';
// A private link for handing vault items to a client: valid until it expires, is turned off, or (view once) has been opened.
export type Share={id:string;lead_id:string;label:string;expires_at:string;view_once:boolean;opened_at:string|null;revoked_at:string|null;password_hash:string};
export const vcookie=(token:string)=>cookieName('v:'+token);
export async function loadShare(token:string):Promise<Share|null>{
 if(!/^[A-Za-z0-9_-]{20,60}$/.test(token))return null;
 const {data}=await serviceClient().from('zarn_vault_shares').select('id,lead_id,label,expires_at,view_once,opened_at,revoked_at,password_hash').eq('token',token).maybeSingle();
 return (data as Share|null)??null;
}
export const shareLive=(s:Share)=>!s.revoked_at&&new Date(s.expires_at)>new Date();
export async function shareUnlocked(token:string){return verifyUnlock('v:'+token,(await cookies()).get(vcookie(token))?.value);}
