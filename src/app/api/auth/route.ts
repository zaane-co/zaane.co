import {createHash} from 'node:crypto';
import {emailBase} from '@/lib/site';
import {sessionClient,serviceClient,configured} from '@/lib/supabase/server';
export async function POST(request:Request){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return Response.json({error:'Invalid origin'},{status:403});
 if(!configured())return Response.json({error:'Connect this site to Supabase before signing in.'},{status:503});
 const body=await request.json().catch(()=>null);
 if(!body)return Response.json({error:'Invalid request'},{status:400});
 const db=await sessionClient();
 if(body.action==='logout'){await db.auth.signOut();return Response.json({ok:true});}
 if(body.action==='forgot'){
  if(typeof body.email!=='string'||!body.email||body.email.length>254)return Response.json({error:'Enter your email.'},{status:400});
  // The reset email goes out through Resend (not Supabase's mailer), so it arrives from Zaane.
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return Response.json({error:'Password reset email is not configured.'},{status:503});
  const email=body.email.trim().toLowerCase(),admin=serviceClient();
  const bucket=createHash('sha256').update((process.env.RATE_LIMIT_SALT||process.env.SUPABASE_SERVICE_ROLE_KEY!)+'reset:'+email).digest('hex');
  const {data:allowed}=await admin.rpc('consume_rate_limit',{bucket});
  if(!allowed)return Response.json({error:'Too many reset requests. Try again in a little while.'},{status:429});
  // Only staff accounts get a link; unknown emails get the same response so accounts can't be probed.
  const {data:member}=await admin.from('users').select('role').eq('email',email).maybeSingle();
  if(!member?.role)return Response.json({ok:true});
  const {data:link,error}=await admin.auth.admin.generateLink({type:'recovery',email});
  if(error||!link.properties?.hashed_token)return Response.json({ok:true});
  const url=`${emailBase()}/admin/auth/callback?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery&next=/admin/reset-password`;
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[email],subject:'Reset your Zaane admin password',text:`Someone asked to reset the password for your Zaane admin account.\n\nSet a new password here (the link expires in 1 hour):\n${url}\n\nIf this wasn't you, you can ignore this email.`,html:`<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111"><p style="font-size:20px;font-weight:600;margin:0 0 16px">Reset your password</p><p style="margin:0 0 24px;line-height:1.5">Someone asked to reset the password for your Zaane admin account. The link expires in 1 hour.</p><a href="${url}" style="display:inline-block;background:#f10c45;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Set a new password</a><p style="margin:24px 0 0;font-size:13px;color:#666;line-height:1.5">If this wasn't you, you can ignore this email.</p></div>`})}).catch(()=>null);
  if(!sent?.ok)return Response.json({error:'We could not send the email. Try again shortly.'},{status:502});
  return Response.json({ok:true});
 }
 if(body.action==='update'){
  if(typeof body.password!=='string'||body.password.length<8||body.password.length>256)return Response.json({error:'Use at least 8 characters.'},{status:400});
  const {data:{user}}=await db.auth.getUser();
  if(!user)return Response.json({error:'Your reset link has expired. Request a new one.'},{status:401});
  const {error}=await db.auth.updateUser({password:body.password});
  if(error)return Response.json({error:error.message},{status:400});
  return Response.json({ok:true});
 }
 if(typeof body.email!=='string'||typeof body.password!=='string'||body.email.length>254||body.password.length>256)return Response.json({error:'Enter your email and password.'},{status:400});
 const {error}=await db.auth.signInWithPassword({email:body.email,password:body.password});
 if(error)return Response.json({error:'Sign-in failed. Check your credentials and try again.'},{status:401});
 const {data:{user}}=await db.auth.getUser();
 const {data}=await db.from('users').select('role').eq('id',user!.id).single();
 if(!data?.role){await db.auth.signOut();return Response.json({error:'Your account does not have staff access. Contact your administrator.'},{status:403});}
 return Response.json({ok:true});
}
