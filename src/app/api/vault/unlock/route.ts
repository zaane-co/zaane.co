import {createHash} from 'crypto';
import {cookies} from 'next/headers';
import {serviceClient} from '@/lib/supabase/server';
import {checkPassword,signUnlock} from '@/lib/doc-share';
import {loadShare,shareLive,vcookie} from '@/lib/vault-share';
// The client enters the password they were given. Guesses are rate limited; a view-once link can only be opened once.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const b=await request.json().catch(()=>null);
 const token=typeof b?.token==='string'?b.token.slice(0,80):'',password=typeof b?.password==='string'?b.password.slice(0,100):'';
 if(!token||!password)return Response.json({error:'Enter the password.'},{status:400});
 const db=serviceClient(),ip=(request.headers.get('x-forwarded-for')||'').split(',')[0]?.trim()||'unknown';
 const bucket=createHash('sha256').update((process.env.RATE_LIMIT_SALT||process.env.SUPABASE_SERVICE_ROLE_KEY!)+'vault:'+token+ip).digest('hex');
 const {data:allowed}=await db.rpc('consume_rate_limit',{bucket});
 if(!allowed)return Response.json({error:'Too many attempts. Try again in a little while.'},{status:429});
 const s=await loadShare(token);
 if(!s||!shareLive(s))return Response.json({error:'This link is no longer available.'},{status:404});
 if(s.view_once&&s.opened_at)return Response.json({error:'This link has already been opened and can’t be used again.'},{status:410});
 if(!checkPassword(password,s.password_hash))return Response.json({error:'That password isn’t right.'},{status:401});
 if(!s.opened_at)await db.from('zarn_vault_shares').update({opened_at:new Date().toISOString()}).eq('id',s.id);
 await db.from('zarn_vault_log').insert({lead_id:s.lead_id,item_label:s.label||'client link',action:'share_open'});
 (await cookies()).set(vcookie(token),signUnlock('v:'+token,60),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:3600});
 return Response.json({ok:true});
}
