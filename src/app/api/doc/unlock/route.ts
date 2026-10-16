import {createHash} from 'crypto';
import {cookies} from 'next/headers';
import {serviceClient} from '@/lib/supabase/server';
import {checkPassword,cookieName,signUnlock} from '@/lib/doc-share';
// Checks the password for a shared document link. Wrong guesses are rate limited per link and per visitor.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const b=await request.json().catch(()=>null);
 const token=typeof b?.token==='string'?b.token.slice(0,80):'',password=typeof b?.password==='string'?b.password.slice(0,100):'';
 if(!token||!password)return Response.json({error:'Enter the password.'},{status:400});
 const db=serviceClient();
 const ip=(request.headers.get('x-forwarded-for')||'').split(',')[0]?.trim()||'unknown';
 const bucket=createHash('sha256').update((process.env.RATE_LIMIT_SALT||process.env.SUPABASE_SERVICE_ROLE_KEY!)+'doc:'+token+ip).digest('hex');
 const {data:allowed}=await db.rpc('consume_rate_limit',{bucket});
 if(!allowed)return Response.json({error:'Too many attempts. Try again in a little while.'},{status:429});
 const {data:l}=await db.from('zarn_doc_links').select('password_hash,expires_at,revoked_at').eq('token',token).maybeSingle();
 if(!l||l.revoked_at||(l.expires_at&&new Date(l.expires_at)<new Date()))return Response.json({error:'This link is no longer available.'},{status:404});
 if(!l.password_hash||!checkPassword(password,l.password_hash))return Response.json({error:'That password isn’t right.'},{status:401});
 (await cookies()).set(cookieName(token),signUnlock(token),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:3600});
 return Response.json({ok:true});
}
