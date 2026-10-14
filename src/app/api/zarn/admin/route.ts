import {z} from 'zod';
import {staff,serviceClient} from '@/lib/supabase/server';
import {isAdmin} from '@/lib/cms';
import {channelSlug} from '@/lib/zarn';
// ZARN administration. Only staff admins and super admins can invite people or manage channels.
const id=z.uuid();
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('invite'),name:z.string().trim().min(1,'Enter their name.').max(80),email:z.email('Enter a valid email.').max(254),title:z.string().trim().max(80).default('')}),
 z.object({action:z.literal('resend'),user_id:id}),
 z.object({action:z.literal('deactivate'),user_id:id}),
 z.object({action:z.literal('reactivate'),user_id:id}),
 z.object({action:z.literal('remove'),user_id:id}),
 z.object({action:z.literal('channel_create'),name:z.string().trim().min(1).max(80),kind:z.enum(['public','private']),topic:z.string().trim().max(250).default(''),is_default:z.boolean().default(false),crm_feed:z.enum(['leads','invoices']).nullable().default(null),members:z.array(id).max(200).default([])}),
 z.object({action:z.literal('channel_update'),id,name:z.string().trim().min(1).max(80).optional(),topic:z.string().trim().max(250).optional(),is_default:z.boolean().optional(),crm_feed:z.enum(['leads','invoices']).nullable().optional()}),
 z.object({action:z.literal('channel_archive'),id,archived:z.boolean()}),
 z.object({action:z.literal('channel_delete'),id}),
 z.object({action:z.literal('channel_members'),id,add:z.array(id).max(200).default([]),remove:z.array(id).max(200).default([])}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function mail(to:string,replyTo:string,subject:string,heading:string,lines:string[],cta:string,url:string){
 if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return false;
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[to],reply_to:replyTo,subject,
  text:`${lines.join('\n\n')}\n\n${cta}: ${url}`,
  html:`<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111"><p style="font-size:22px;font-weight:800;margin:0 0 4px;letter-spacing:-.02em">ZARN</p><p style="font-size:18px;font-weight:600;margin:16px 0">${esc(heading)}</p>${lines.map(l=>`<p style="margin:0 0 12px;line-height:1.5">${esc(l)}</p>`).join('')}<a href="${url}" style="display:inline-block;margin-top:12px;background:#f10c45;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${esc(cta)}</a></div>`})}).catch(()=>null);
 return !!r?.ok;
}
export async function POST(request:Request){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return fail('Invalid origin',403);
 const me=await staff();if(!me||!isAdmin(me.role))return fail('Only admins can manage ZARN.',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=serviceClient();
 const joinDefaults=async(userId:string)=>{const {data:ch}=await db.from('zarn_channels').select('id').eq('is_default',true).is('archived_at',null);if(ch?.length)await db.from('zarn_channel_members').upsert(ch.map(c=>({channel_id:c.id,user_id:userId})),{onConflict:'channel_id,user_id',ignoreDuplicates:true});};
 const invite=async(email:string,first:string,type:'invite'|'magiclink')=>{
  const {data:link,error}=await db.auth.admin.generateLink({type,email,options:type==='invite'?{data:{name:first}}:undefined});
  if(error||!link.user||!link.properties?.hashed_token)return null;
  const url=`${origin}/admin/auth/callback?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=${type}&next=/zarn/welcome`;
  const sent=await mail(email,me.email,'You’re invited to ZARN','Join the Zaane team on ZARN',[`Hi ${first.split(' ')[0]}, ${me.name||'the Zaane team'} invited you to ZARN, our team chat.`,'Set your password to get started. The link expires in 24 hours.'],'Accept invite',url);
  return {userId:link.user.id,sent};
 };
 switch(b.action){
  case 'invite':{
   const email=b.email.toLowerCase();
   const {data:already}=await db.from('zarn_members').select('user_id,deactivated_at').eq('email',email).maybeSingle();
   if(already)return fail(already.deactivated_at?'They’re deactivated. Reactivate them instead.':'They’re already a member.');
   // Existing account (e.g. staff): add them and tell them to sign in with their current password.
   const {data:existing}=await db.from('users').select('id,name').eq('email',email).maybeSingle();
   if(existing){
    const {error}=await db.from('zarn_members').insert({user_id:existing.id,email,display_name:b.name,title:b.title,invited_by:me.id,joined_at:new Date().toISOString()});
    if(error)return fail('Could not add them.');
    await joinDefaults(existing.id);
    const sent=await mail(email,me.email,'You’ve been added to ZARN','You’re on ZARN',[`Hi ${b.name.split(' ')[0]}, ${me.name||'the Zaane team'} added you to ZARN, our team chat.`,'Sign in with the same email and password you already use for Zaane.'],'Open ZARN',`${origin}/zarn/login`);
    return Response.json({ok:true,existing:true,emailed:sent});
   }
   const r=await invite(email,b.name,'invite');if(!r)return fail('Could not create the invite.');
   const {error}=await db.from('zarn_members').insert({user_id:r.userId,email,display_name:b.name,title:b.title,invited_by:me.id});
   if(error){await db.auth.admin.deleteUser(r.userId);return fail('Could not add them.');}
   await joinDefaults(r.userId);
   return Response.json({ok:true,emailed:r.sent});
  }
  case 'resend':{
   const {data:m}=await db.from('zarn_members').select('email,display_name,joined_at').eq('user_id',b.user_id).single();
   if(!m)return fail('Member not found.',404);if(m.joined_at)return fail('They’ve already joined.');
   const r=await invite(m.email,m.display_name,'magiclink');
   return r?.sent?Response.json({ok:true}):fail('Could not send the invite.',502);
  }
  case 'deactivate':case 'reactivate':{
   if(b.user_id===me.id)return fail('You can’t deactivate yourself.');
   const {error}=await db.from('zarn_members').update({deactivated_at:b.action==='deactivate'?new Date().toISOString():null}).eq('user_id',b.user_id);
   return error?fail('Could not update this member.'):Response.json({ok:true});
  }
  case 'remove':{
   if(b.user_id===me.id)return fail('You can’t remove yourself.');
   // Staff keep their login; chat-only people are deleted entirely.
   const {data:s}=await db.from('users').select('role').eq('id',b.user_id).maybeSingle();
   if(s?.role){const {error}=await db.from('zarn_members').delete().eq('user_id',b.user_id);return error?fail('Could not remove them.'):Response.json({ok:true});}
   const {error}=await db.auth.admin.deleteUser(b.user_id);
   return error?fail('Could not remove them.'):Response.json({ok:true});
  }
  case 'channel_create':{
   const name=channelSlug(b.name);if(!name)return fail('Use letters or numbers in the channel name.');
   const {data:c,error}=await db.from('zarn_channels').insert({name,kind:b.kind,topic:b.topic,is_default:b.kind==='public'&&b.is_default,crm_feed:b.crm_feed,created_by:me.id}).select('id').single();
   if(error)return fail(error.code==='23505'?'A channel with that name already exists.':'Could not create the channel.');
   const members=[...new Set(b.members)];
   if(b.is_default&&b.kind==='public'){const {data:all}=await db.from('zarn_members').select('user_id').is('deactivated_at',null);members.push(...(all??[]).map(m=>m.user_id));}
   if(members.length)await db.from('zarn_channel_members').upsert([...new Set(members)].map(user_id=>({channel_id:c.id,user_id})),{onConflict:'channel_id,user_id',ignoreDuplicates:true});
   return Response.json({ok:true,id:c.id});
  }
  case 'channel_update':{
   const patch:Record<string,unknown>={};
   if(b.name!==undefined){const n=channelSlug(b.name);if(!n)return fail('Use letters or numbers in the channel name.');patch.name=n;}
   if(b.topic!==undefined)patch.topic=b.topic;if(b.is_default!==undefined)patch.is_default=b.is_default;if(b.crm_feed!==undefined)patch.crm_feed=b.crm_feed;
   const {error}=await db.from('zarn_channels').update(patch).eq('id',b.id).neq('kind','dm');
   return error?fail(error.code==='23505'?'A channel with that name already exists.':'Could not update the channel.'):Response.json({ok:true});
  }
  case 'channel_archive':{
   const {error}=await db.from('zarn_channels').update({archived_at:b.archived?new Date().toISOString():null}).eq('id',b.id).neq('kind','dm');
   return error?fail('Could not update the channel.'):Response.json({ok:true});
  }
  case 'channel_delete':{
   const {error}=await db.from('zarn_channels').delete().eq('id',b.id).neq('kind','dm');
   return error?fail('Could not delete the channel.'):Response.json({ok:true});
  }
  case 'channel_members':{
   if(b.add.length)await db.from('zarn_channel_members').upsert(b.add.map(user_id=>({channel_id:b.id,user_id})),{onConflict:'channel_id,user_id',ignoreDuplicates:true});
   if(b.remove.length)await db.from('zarn_channel_members').delete().eq('channel_id',b.id).in('user_id',b.remove);
   return Response.json({ok:true});
  }
 }
}
