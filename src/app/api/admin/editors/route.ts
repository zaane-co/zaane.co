import {staff,serviceClient} from '@/lib/supabase/server';
import {uuid} from '@/lib/blog-public';
import {revalidatePath} from 'next/cache';
const str=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function send(payload:Record<string,unknown>){
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,...payload})}).catch(()=>null);
 return !!r?.ok;
}
// Super admins invite, email and remove blog editors. Invites go out through Resend; the editor sets their own password.
export async function POST(request:Request){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await staff();if(me?.role!=='super_admin')return Response.json({error:'Only a super admin can manage editors.'},{status:403});
 if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return Response.json({error:'Email sending is not configured.'},{status:503});
 const body=await request.json().catch(()=>null);if(!body)return Response.json({error:'Invalid request'},{status:400});
 const db=serviceClient();
 if(body.action==='invite'){
  const first=str(body.first_name,60),last=str(body.last_name,60),email=str(body.email,254).toLowerCase(),bio=str(body.bio,600);
  if(!first||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:'First name and a valid email are required.'},{status:400});
  const name=[first,last].filter(Boolean).join(' ');
  const {data:link,error}=await db.auth.admin.generateLink({type:'invite',email,options:{data:{name}}});
  if(error||!link.user||!link.properties?.hashed_token)return Response.json({error:/already|registered|exists/i.test(error?.message||'')?'That email already has an account. Assign its role under Users & roles.':'Could not create the invite.'},{status:400});
  const {data:row,error:e}=await db.from('users').upsert({id:link.user.id,email,name,role:'editor',bio}).select('id,email,name,bio,role,created_at').single();
  if(e){await db.auth.admin.deleteUser(link.user.id);return Response.json({error:'Could not create the editor.'},{status:400});}
  const url=`${origin}/admin/auth/callback?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=invite&next=/admin/reset-password`;
  const ok=await send({to:[email],reply_to:me.email,subject:'You’re invited to edit the Zaane blog',text:`Hi ${first},\n\n${me.name||'The Zaane team'} added you as an editor on the Zaane blog. Set your password to get started (this link expires in 24 hours):\n${url}\n\nAfter that, sign in at ${origin}/admin/login with ${email}.`,html:`<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111"><p style="font-size:20px;font-weight:600;margin:0 0 16px">You’re invited to the Zaane blog</p><p style="margin:0 0 24px;line-height:1.5">Hi ${esc(first)}, ${esc(me.name||'the Zaane team')} added you as an editor. Set your password to get started. The link expires in 24 hours.</p><a href="${url}" style="display:inline-block;background:#f10c45;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Set your password</a><p style="margin:24px 0 0;font-size:13px;color:#666;line-height:1.5">Afterwards, sign in at ${origin}/admin/login with ${esc(email)}.</p></div>`});
  revalidatePath('/admin/editors');
  return Response.json({editor:{...row,first_name:first,last_name:last,last_sign_in_at:null,verified:false,post_count:0},emailed:ok});
 }
 if(!uuid.test(String(body.id)))return Response.json({error:'Invalid request'},{status:400});
 const {data:target}=await db.from('users').select('id,email,name,role').eq('id',body.id).maybeSingle();
 if(target?.role!=='editor')return Response.json({error:'That account is not an editor.'},{status:400});
 if(body.action==='email'){
  const subject=str(body.subject,200),text=str(body.body,10000);
  if(!subject||!text)return Response.json({error:'Add a subject and a message.'},{status:400});
  return await send({to:[target.email],reply_to:me.email,subject,text})?Response.json({ok:true}):Response.json({error:'Could not send the email.'},{status:502});
 }
 if(body.action==='delete'){
  const {error}=await db.auth.admin.deleteUser(target.id);if(error)return Response.json({error:'Could not remove this editor.'},{status:400});
  revalidatePath('/admin/editors');return Response.json({ok:true});
 }
 return Response.json({error:'Invalid request'},{status:400});
}
