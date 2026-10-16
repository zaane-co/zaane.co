import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {canAddClients,canManageTeams,clientAccess,isStudioAdmin} from '@/lib/zarn-clients';
import {currencies} from '@/lib/crm';
// Client spaces in ZARN. A client is a CRM lead plus a private conversation for the staff assigned to it.
const id=z.uuid();
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),name:z.string().trim().min(1,'Enter the client’s name.').max(120),company:z.string().trim().max(200).default(''),email:z.union([z.email(),z.literal('')]).default(''),phone:z.string().trim().max(40).default(''),service:z.string().trim().max(120).default(''),deal_value:z.number().nonnegative().max(1e12).nullable().default(null),currency:z.enum(currencies).default('NGN'),brief:z.string().trim().max(10000).default(''),team:z.array(id).max(50).default([])}),
 z.object({action:z.literal('open'),lead_id:id}),
 z.object({action:z.literal('team'),lead_id:id,add:z.array(id).max(50).default([]),remove:z.array(id).max(50).default([])}),
 z.object({action:z.literal('stage'),lead_id:id,status:z.string().regex(/^[a-z0-9_]{1,40}$/)}),
 z.object({action:z.literal('task_add'),lead_id:id,title:z.string().trim().min(1,'Give the task a title.').max(300),due_at:z.iso.datetime({offset:true}).nullable().default(null),assignee_id:id.nullable().default(null)}),
 z.object({action:z.literal('task_toggle'),lead_id:id,id,done:z.boolean()}),
 z.object({action:z.literal('task_delete'),lead_id:id,id}),
 z.object({action:z.literal('note'),lead_id:id,body:z.string().trim().min(1).max(5000)}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in to ZARN first.',401);
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=serviceClient();
 // Active non-guest members only can be put on a client team.
 const teamable=async(ids:string[])=>ids.length?((await db.from('zarn_members').select('user_id').in('user_id',ids).is('deactivated_at',null).eq('account_type','member')).data??[]).map(m=>m.user_id):[];
 const openSpace=async(leadId:string,team:string[])=>{
  const {data:existing}=await db.from('zarn_channels').select('id').eq('kind','client').eq('lead_id',leadId).maybeSingle();
  const channelId=existing?.id??(await db.from('zarn_channels').insert({kind:'client',lead_id:leadId,created_by:me.user_id}).select('id').single()).data?.id;
  if(!channelId)throw new Error('Could not open the client space.');
  const people=[...new Set([me.user_id,...await teamable(team)])];
  await db.from('zarn_channel_members').upsert(people.map(user_id=>({channel_id:channelId,user_id})),{onConflict:'channel_id,user_id',ignoreDuplicates:true});
  if(!existing)await db.from('zarn_messages').insert({channel_id:channelId,kind:'system',meta:{event:'client_opened',by:me.user_id}});
  return channelId;
 };
 switch(b.action){
  case 'create':{
   if(!canAddClients(me))return fail('You don’t have permission to add clients.',403);
   const {data:won}=await db.from('pipeline_stages').select('key').eq('kind','won').order('position').limit(1).maybeSingle();
   const {data:lead,error}=await db.from('leads').insert({name:b.name,company:b.company,email:b.email.toLowerCase(),phone:b.phone,service_interested:b.service,message:b.brief,project_description:b.brief,deal_value:isStudioAdmin(me)?b.deal_value:null,currency:b.currency,source:'other',status:won?.key??'new',owner_id:me.user_id}).select('id').single();
   if(error||!lead)return fail('Could not save the client.');
   try{await openSpace(lead.id,b.team);}catch(e){return fail(e instanceof Error?e.message:'Could not open the client space.');}
   return Response.json({ok:true,lead_id:lead.id});
  }
  case 'open':{
   if(!canAddClients(me))return fail('You don’t have permission to open client spaces.',403);
   const {data:lead}=await db.from('leads').select('id').eq('id',b.lead_id).maybeSingle();if(!lead)return fail('Client not found.',404);
   try{await openSpace(b.lead_id,[]);}catch(e){return fail(e instanceof Error?e.message:'Could not open the client space.');}
   return Response.json({ok:true,lead_id:b.lead_id});
  }
 }
 // Everything else needs access to this client's space.
 const {channel,allowed}=await clientAccess(me,b.lead_id);
 if(!channel||!allowed)return fail('You’re not on this client’s team.',403);
 switch(b.action){
  case 'team':{
   if(!canManageTeams(me))return fail('Only admins and sales can change a client’s team.',403);
   const add=await teamable(b.add);
   if(add.length){await db.from('zarn_channel_members').upsert(add.map(user_id=>({channel_id:channel.id,user_id})),{onConflict:'channel_id,user_id',ignoreDuplicates:true});
    await db.from('zarn_messages').insert({channel_id:channel.id,kind:'system',meta:{event:'members_added',by:me.user_id,users:add.join(',')}});}
   if(b.remove.length){await db.from('zarn_channel_members').delete().eq('channel_id',channel.id).in('user_id',b.remove);
    await db.from('zarn_messages').insert({channel_id:channel.id,kind:'system',meta:{event:'members_removed',by:me.user_id,users:b.remove.join(',')}});}
   return Response.json({ok:true});
  }
  case 'stage':{
   const {data:s}=await db.from('pipeline_stages').select('key').eq('key',b.status).maybeSingle();if(!s)return fail('Unknown stage.');
   const {error}=await db.from('leads').update({status:b.status}).eq('id',b.lead_id);
   return error?fail('Could not change the stage.'):Response.json({ok:true});
  }
  case 'task_add':{
   const {error}=await db.from('lead_tasks').insert({lead_id:b.lead_id,title:b.title,due_at:b.due_at,assignee_id:b.assignee_id??me.user_id,created_by:me.user_id});
   return error?fail('Could not add the task.'):Response.json({ok:true});
  }
  case 'task_toggle':{
   const {data,error}=await db.from('lead_tasks').update({done_at:b.done?new Date().toISOString():null}).eq('id',b.id).eq('lead_id',b.lead_id).select('title').single();
   if(error)return fail('Could not update the task.');
   if(b.done)await db.from('lead_activities').insert({lead_id:b.lead_id,kind:'task',body:data.title,author_id:me.user_id});
   return Response.json({ok:true});
  }
  case 'task_delete':{
   const {error}=await db.from('lead_tasks').delete().eq('id',b.id).eq('lead_id',b.lead_id);
   return error?fail('Could not delete the task.'):Response.json({ok:true});
  }
  case 'note':{
   const {error}=await db.from('lead_activities').insert({lead_id:b.lead_id,kind:'note',body:b.body,author_id:me.user_id});
   return error?fail('Could not save the note.'):Response.json({ok:true});
  }
 }
}
