import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {channelSlug} from '@/lib/zarn';
import {pushTo} from '@/lib/zarn-push';
// Member actions that need more than RLS allows: creating channels, adding people, topics and pins.
const id=z.uuid();
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('channel_create'),name:z.string().trim().min(1).max(80),kind:z.enum(['public','private']),topic:z.string().trim().max(250).default(''),members:z.array(id).max(200).default([])}),
 z.object({action:z.literal('channel_add'),id,members:z.array(id).min(1).max(200)}),
 z.object({action:z.literal('invites')}),
 z.object({action:z.literal('invite_accept'),channel_id:id}),
 z.object({action:z.literal('invite_decline'),channel_id:id}),
 z.object({action:z.literal('topic'),id,topic:z.string().trim().max(250)}),
 z.object({action:z.literal('pin'),message_id:id,pinned:z.boolean()}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in to ZARN first.',401);
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,admin=serviceClient();
 // Membership is checked with the member's own session (RLS), writes use the service client.
 const inChannel=async(c:string)=>!!(await me.db.from('zarn_channel_members').select('channel_id').eq('channel_id',c).eq('user_id',me.user_id).maybeSingle()).data;
 // Private channels never add people directly: each person gets an invitation they accept or decline.
 const invite=async(channelId:string,name:string|null,userIds:string[])=>{
  const {data:existing}=await admin.from('zarn_channel_members').select('user_id').eq('channel_id',channelId).in('user_id',userIds);
  const skip=new Set((existing??[]).map(r=>r.user_id));
  const ids=userIds.filter(u=>!skip.has(u)&&u!==me.user_id);if(!ids.length)return 0;
  await admin.from('zarn_channel_invites').upsert(ids.map(user_id=>({channel_id:channelId,user_id,invited_by:me.user_id})),{onConflict:'channel_id,user_id',ignoreDuplicates:true});
  await admin.from('zarn_messages').insert({channel_id:channelId,kind:'system',meta:{event:'members_invited',by:me.user_id,users:ids.join(',')}});
  await pushTo(ids,{title:`${me.display_name} invited you`,body:`#${name??'private channel'} · tap to accept`,tag:`invite-${channelId}`,url:'/zarn'});
  return ids.length;
 };
 switch(b.action){
  case 'channel_create':{
   if(me.account_type==='guest'||!me.can_create_channels)return fail('You don’t have permission to create channels. Ask an admin.',403);
   const name=channelSlug(b.name);if(!name)return fail('Use letters or numbers in the channel name.');
   const {data:c,error}=await admin.from('zarn_channels').insert({name,kind:b.kind,topic:b.topic,created_by:me.user_id}).select('id').single();
   if(error)return fail(error.code==='23505'?'A channel with that name already exists.':'Could not create the channel.');
   const {data:active}=await admin.from('zarn_members').select('user_id').in('user_id',[me.user_id,...b.members]).is('deactivated_at',null);
   const direct=b.kind==='private'?(active??[]).filter(m=>m.user_id===me.user_id):(active??[]);
   await admin.from('zarn_channel_members').insert(direct.map(m=>({channel_id:c.id,user_id:m.user_id})));
   if(b.kind==='private'&&b.members.length)await invite(c.id,name,(active??[]).map(m=>m.user_id));
   if(b.kind==='public'||b.members.length)await admin.from('zarn_messages').insert({channel_id:c.id,kind:'system',meta:{event:'channel_created',by:me.user_id}});
   return Response.json({ok:true,id:c.id});
  }
  case 'channel_add':{
   if(!await inChannel(b.id))return fail('Join the channel first.',403);
   const {data:ch}=await admin.from('zarn_channels').select('kind,archived_at,name').eq('id',b.id).single();
   // Client teams are managed from the client space (admins and sales only), DMs are fixed.
   if(!ch||(ch.kind!=='public'&&ch.kind!=='private')||ch.archived_at)return fail('You can’t add people here.');
   const {data:active}=await admin.from('zarn_members').select('user_id').in('user_id',b.members).is('deactivated_at',null);
   if(active?.length&&ch.kind==='private'){await invite(b.id,ch.name,active.map(m=>m.user_id));return Response.json({ok:true,invited:true});}
   if(active?.length){
    await admin.from('zarn_channel_members').upsert(active.map(m=>({channel_id:b.id,user_id:m.user_id})),{onConflict:'channel_id,user_id',ignoreDuplicates:true});
    await admin.from('zarn_messages').insert({channel_id:b.id,kind:'system',meta:{event:'members_added',by:me.user_id,users:active.map(m=>m.user_id).join(',')}});
   }
   return Response.json({ok:true});
  }
  case 'invites':{
   const {data:rows}=await admin.from('zarn_channel_invites').select('channel_id,invited_by,created_at').eq('user_id',me.user_id).order('created_at',{ascending:false});
   if(!rows?.length)return Response.json({ok:true,invites:[]});
   const [{data:chs},{data:who}]=await Promise.all([
    admin.from('zarn_channels').select('id,name,topic,archived_at').in('id',rows.map(r=>r.channel_id)),
    admin.from('zarn_members').select('user_id,display_name').in('user_id',rows.map(r=>r.invited_by).filter(Boolean) as string[]),
   ]);
   const invites=rows.map(r=>{const c=chs?.find(x=>x.id===r.channel_id);const w=who?.find(x=>x.user_id===r.invited_by);return c&&!c.archived_at?{channel_id:r.channel_id,name:c.name,topic:c.topic,inviter:w?.display_name??'Someone',created_at:r.created_at}:null;}).filter(Boolean);
   return Response.json({ok:true,invites});
  }
  case 'invite_accept':{
   const {data:inv}=await admin.from('zarn_channel_invites').select('channel_id').eq('channel_id',b.channel_id).eq('user_id',me.user_id).maybeSingle();
   if(!inv)return fail('This invitation is no longer available.',404);
   await admin.from('zarn_channel_members').upsert({channel_id:b.channel_id,user_id:me.user_id},{onConflict:'channel_id,user_id',ignoreDuplicates:true});
   await admin.from('zarn_channel_invites').delete().eq('channel_id',b.channel_id).eq('user_id',me.user_id);
   await admin.from('zarn_messages').insert({channel_id:b.channel_id,kind:'system',meta:{event:'joined',by:me.user_id}});
   return Response.json({ok:true});
  }
  case 'invite_decline':{
   await admin.from('zarn_channel_invites').delete().eq('channel_id',b.channel_id).eq('user_id',me.user_id);
   return Response.json({ok:true});
  }
  case 'topic':{
   if(!await inChannel(b.id))return fail('Join the channel first.',403);
   const {error}=await admin.from('zarn_channels').update({topic:b.topic}).eq('id',b.id);
   if(error)return fail('Could not set the topic.');
   await admin.from('zarn_messages').insert({channel_id:b.id,kind:'system',meta:{event:'topic',by:me.user_id,topic:b.topic}});
   return Response.json({ok:true});
  }
  case 'pin':{
   const {data:m}=await me.db.from('zarn_messages').select('channel_id').eq('id',b.message_id).maybeSingle();
   if(!m||!await inChannel(m.channel_id))return fail('You can’t pin here.',403);
   const {error}=await admin.from('zarn_messages').update({pinned_at:b.pinned?new Date().toISOString():null,pinned_by:b.pinned?me.user_id:null}).eq('id',b.message_id);
   return error?fail('Could not pin this message.'):Response.json({ok:true});
  }
 }
}
