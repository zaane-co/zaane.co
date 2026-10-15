import {z} from 'zod';
import {emailBase} from '@/lib/site';
import {staff,serviceClient} from '@/lib/supabase/server';
import {roles,roleInfo} from '@/lib/cms';
const role=z.enum(roles);
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('invite'),name:z.string().trim().min(1,'Enter their name.').max(120),email:z.email('Enter a valid email.').max(254),role}),
 z.object({action:z.literal('set_role'),id:z.uuid(),role:role.nullable()}),
 z.object({action:z.literal('remove'),id:z.uuid()}),
 z.object({action:z.literal('send_password'),id:z.uuid()}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
// A readable temporary password: three groups of four, always with upper, lower and a digit.
function tempPassword(){
 const sets=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnpqrstuvwxyz','23456789'],all=sets.join('');
 const pick=(chars:string)=>chars[crypto.getRandomValues(new Uint32Array(1))[0]!%chars.length]!;
 for(;;){const raw=Array.from({length:12},()=>pick(all)).join('');if(sets.every(set=>[...raw].some(c=>set.includes(c))))return raw.match(/.{4}/g)!.join('-');}
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Super admins invite staff into a role, change roles and remove access. Invites go out through Resend.
export async function POST(request:Request){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return fail('Invalid origin',403);
 const me=await staff();if(me?.role!=='super_admin')return fail('Only a super admin can manage staff.',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=serviceClient();
 if(b.action!=='invite'&&b.action!=='send_password'&&b.id===me.id)return fail('You can’t change or remove your own access. Ask another super admin.');
 switch(b.action){
  case 'invite':{
   if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return fail('Email sending is not configured.',503);
   const email=b.email.toLowerCase();
   // Already has an account: just give them the role.
   const {data:existing}=await db.from('users').select('id').eq('email',email).maybeSingle();
   if(existing){const {error}=await db.from('users').update({role:b.role,name:b.name}).eq('id',existing.id);return error?fail('Could not update their role.'):Response.json({ok:true,existing:true});}
   const {data:link,error}=await db.auth.admin.generateLink({type:'invite',email,options:{data:{name:b.name}}});
   if(error||!link.user||!link.properties?.hashed_token)return fail('Could not create the invite.');
   const {error:e}=await db.from('users').upsert({id:link.user.id,email,name:b.name,role:b.role});
   if(e){await db.auth.admin.deleteUser(link.user.id);return fail('Could not create the account.');}
   const url=`${emailBase()}/admin/auth/callback?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=invite&next=/admin/reset-password`;
   const first=b.name.split(' ')[0]!,label=roleInfo[b.role].label;
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[email],reply_to:me.email,subject:'You’re invited to the Zaane studio admin',
    text:`Hi ${first},\n\n${me.name||'The Zaane team'} added you to the Zaane studio admin as ${label}: ${roleInfo[b.role].summary}\n\nSet your password to get started (this link expires in 24 hours):\n${url}\n\nAfter that, sign in at ${emailBase()}/admin/login with ${email}.`,
    html:`<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111"><p style="font-size:20px;font-weight:600;margin:0 0 16px">You’re invited to the Zaane studio admin</p><p style="margin:0 0 8px;line-height:1.5">Hi ${esc(first)}, ${esc(me.name||'the Zaane team')} added you as <b>${esc(label)}</b>.</p><p style="margin:0 0 24px;line-height:1.5;color:#555">${esc(roleInfo[b.role].summary)}</p><a href="${url}" style="display:inline-block;background:#f10c45;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Set your password</a><p style="margin:24px 0 0;font-size:13px;color:#666;line-height:1.5">The link expires in 24 hours. Afterwards, sign in at ${emailBase()}/admin/login with ${esc(email)}.</p></div>`})}).catch(()=>null);
   return Response.json({ok:true,emailed:!!r?.ok});
  }
  case 'set_role':{
   const {error}=await db.from('users').update({role:b.role}).eq('id',b.id);
   return error?fail('Could not change the role.'):Response.json({ok:true});
  }
  case 'send_password':{
   // Sets a new temporary password and emails it, with a link to choose their own. Works for anyone, including super admins.
   if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return fail('Email sending is not configured.',503);
   const [{data:user},{data:chat}]=await Promise.all([db.from('users').select('email,name,role').eq('id',b.id).maybeSingle(),db.from('zarn_members').select('display_name,deactivated_at').eq('user_id',b.id).maybeSingle()]);
   if(!user?.email)return fail('This account has no email address.');
   const studio=!!user.role,zarn=!!chat&&!chat.deactivated_at;
   const password=tempPassword();
   const {error}=await db.auth.admin.updateUserById(b.id,{password});
   if(error)return fail('Could not set a new password.');
   const {data:link}=await db.auth.admin.generateLink({type:'recovery',email:user.email});
   const base=emailBase(),reset=link?.properties?.hashed_token?`${base}/admin/auth/callback?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery&next=${studio?'/admin/reset-password':'/zarn/password'}`:'';
   const logins=[studio&&['Studio admin',`${base}/admin/login`],zarn&&['ZARN',`${base}/zarn/login`]].filter(Boolean) as [string,string][];
   if(!logins.length)logins.push(['Studio admin',`${base}/admin/login`]);
   const first=(user.name||chat?.display_name||user.email.split('@')[0]!).split(' ')[0]!,by=me.id===b.id?'You':me.name||'A Zaane admin';
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[user.email],reply_to:me.email,subject:'Your new Zaane password',
    text:`Hi ${first},\n\n${by} reset your Zaane password. Your old password no longer works.\n\nEmail: ${user.email}\nNew password: ${password}\n\nSign in:\n${logins.map(([l,u])=>`${l}: ${u}`).join('\n')}\n\n${reset?`Prefer your own password? Set one here (link expires in 1 hour):\n${reset}\n\n`:''}If you didn't expect this, reply to this email.`,
    html:`<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111"><p style="font-size:20px;font-weight:600;margin:0 0 16px">Your new Zaane password</p><p style="margin:0 0 20px;line-height:1.5">Hi ${esc(first)}, ${esc(by)} reset your Zaane password. Your old password no longer works.</p><div style="background:#f4f4f5;border-radius:12px;padding:16px 18px;margin:0 0 20px"><p style="margin:0 0 6px;font-size:13px;color:#555">Email</p><p style="margin:0 0 14px;font-weight:600">${esc(user.email)}</p><p style="margin:0 0 6px;font-size:13px;color:#555">New password</p><p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:20px;font-weight:700;letter-spacing:1px">${password}</p></div>${logins.map(([l,u])=>`<a href="${u}" style="display:inline-block;background:#f10c45;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;margin:0 8px 8px 0">Sign in to ${esc(l)}</a>`).join('')}${reset?`<p style="margin:20px 0 0;line-height:1.5;color:#555;font-size:14px">Prefer your own password? <a href="${reset}" style="color:#f10c45">Set one now</a> (link expires in 1 hour).</p>`:''}<p style="margin:24px 0 0;color:#888;font-size:12px">If you didn't expect this, reply to this email.</p></div>`})}).catch(()=>null);
   return r?.ok?Response.json({ok:true,email:user.email}):fail(`The password was changed but the email failed to send. Try again.`,502);
  }
  case 'remove':{
   const {error}=await db.auth.admin.deleteUser(b.id);
   return error?fail('Could not remove this account.'):Response.json({ok:true});
  }
 }
}
