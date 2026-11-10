import 'server-only';
import {emailBase} from '@/lib/site';
import type {serviceClient} from '@/lib/supabase/server';

// A readable temporary password: three groups of four, always with upper, lower and a digit.
function tempPassword(){
 const sets=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnpqrstuvwxyz','23456789'],all=sets.join('');
 const pick=(chars:string)=>chars[crypto.getRandomValues(new Uint32Array(1))[0]!%chars.length]!;
 for(;;){const raw=Array.from({length:12},()=>pick(all)).join('');if(sets.every(set=>[...raw].some(c=>set.includes(c))))return raw.match(/.{4}/g)!.join('-');}
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

type Me={id:string;name:string|null;email:string};
// Sets a new temporary password on the account and emails it, with sign-in links for Studio and/or ZARN
// and a link to choose their own. Returns an error message, or null on success.
export async function sendNewPassword(db:ReturnType<typeof serviceClient>,me:Me,userId:string):Promise<{error:string;status:number}|null>{
 if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return {error:'Email sending is not configured.',status:503};
 const [{data:user},{data:chat}]=await Promise.all([db.from('users').select('email,name,role').eq('id',userId).maybeSingle(),db.from('zarn_members').select('email,display_name,deactivated_at').eq('user_id',userId).maybeSingle()]);
 const email=user?.email||chat?.email;
 if(!email)return {error:'This account has no email address.',status:400};
 const studio=!!user?.role,zarn=!!chat&&!chat.deactivated_at;
 const password=tempPassword();
 const {error}=await db.auth.admin.updateUserById(userId,{password});
 if(error)return {error:'Could not set a new password.',status:500};
 const {data:link}=await db.auth.admin.generateLink({type:'recovery',email});
 const base=emailBase(),reset=link?.properties?.hashed_token?`${base}/admin/auth/callback?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery&next=${studio?'/admin/reset-password':'/zarn/password'}`:'';
 const logins=[studio&&['Studio admin',`${base}/admin/login`],zarn&&['ZARN',`${base}/zarn/login`]].filter(Boolean) as [string,string][];
 if(!logins.length)logins.push(['Studio admin',`${base}/admin/login`]);
 const first=(user?.name||chat?.display_name||email.split('@')[0]!).split(' ')[0]!,by=me.id===userId?'You':me.name||'A Zaane admin';
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[email],reply_to:me.email,subject:'Your new Zaane password',
  text:`Hi ${first},\n\n${by} reset your Zaane password. Your old password no longer works.\n\nEmail: ${email}\nNew password: ${password}\n\nSign in:\n${logins.map(([l,u])=>`${l}: ${u}`).join('\n')}\n\n${reset?`Prefer your own password? Set one here (link expires in 1 hour):\n${reset}\n\n`:''}If you didn't expect this, reply to this email.`,
  html:`<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111"><p style="font-size:20px;font-weight:600;margin:0 0 16px">Your new Zaane password</p><p style="margin:0 0 20px;line-height:1.5">Hi ${esc(first)}, ${esc(by)} reset your Zaane password. Your old password no longer works.</p><div style="background:#f4f4f5;border-radius:12px;padding:16px 18px;margin:0 0 20px"><p style="margin:0 0 6px;font-size:13px;color:#555">Email</p><p style="margin:0 0 14px;font-weight:600">${esc(email)}</p><p style="margin:0 0 6px;font-size:13px;color:#555">New password</p><p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:20px;font-weight:700;letter-spacing:1px">${password}</p></div>${logins.map(([l,u])=>`<a href="${u}" style="display:inline-block;background:#f10c45;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;margin:0 8px 8px 0">Sign in to ${esc(l)}</a>`).join('')}${reset?`<p style="margin:20px 0 0;line-height:1.5;color:#555;font-size:14px">Prefer your own password? <a href="${reset}" style="color:#f10c45">Set one now</a> (link expires in 1 hour).</p>`:''}<p style="margin:24px 0 0;color:#888;font-size:12px">If you didn't expect this, reply to this email.</p></div>`})}).catch(()=>null);
 return r?.ok?null:{error:'The password was changed but the email failed to send. Try again.',status:502};
}
