import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {channelHref} from '@/lib/zarn';
import {iceServers,pushTo} from '@/lib/zarn-push';
// Voice call state: start, answer, decline, end. Audio and signaling never touch this route; it only records who is calling whom.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad=(error:string,status=400)=>Response.json({error},{status});
const RING_MS=60_000;
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return bad('Invalid origin',403);
 const me=await zarnMember();if(!me)return bad('Sign in first.',401);
 const b=await request.json().catch(()=>null);
 if(!b||!['start','answer','decline','end'].includes(b.action))return bad('Invalid request');
 const svc=serviceClient();

 if(b.action==='start'){
  if(!uuid.test(String(b.channel_id)))return bad('Invalid request');
  const {data:ch}=await svc.from('zarn_channels').select('id,kind,dm_key,lead_id').eq('id',b.channel_id).single();
  const other=ch?.kind==='dm'?(ch.dm_key??'').split(',').filter((u:string)=>u!==me.user_id):[];
  if(!ch||other.length!==1||!(ch.dm_key??'').split(',').includes(me.user_id))return bad('Calls work in one-to-one messages.');
  const calleeId=other[0]!;
  const {data:callee}=await svc.from('zarn_members').select('user_id,deactivated_at').eq('user_id',calleeId).maybeSingle();
  if(!callee||callee.deactivated_at)return bad('This person can’t be called.');
  // Clear calls nobody answered, then refuse if either side is already on a call.
  await svc.from('zarn_calls').update({status:'missed',ended_at:new Date().toISOString()}).eq('status','ringing').lt('created_at',new Date(Date.now()-RING_MS).toISOString());
  const {data:busy}=await svc.from('zarn_calls').select('id,caller_id').in('status',['ringing','active']).or(`caller_id.in.(${me.user_id},${calleeId}),callee_id.in.(${me.user_id},${calleeId})`).limit(1);
  if(busy?.length)return bad('One of you is already on a call.',409);
  const {data:call,error}=await svc.from('zarn_calls').insert({channel_id:ch.id,caller_id:me.user_id,callee_id:calleeId}).select('id').single();
  if(error||!call)return bad('Could not start the call.',500);
  await pushTo([calleeId],{title:`${me.display_name} is calling`,body:'Voice call · tap to answer',tag:`call-${call.id}`,url:`${channelHref(ch,ch.id)}`,call:call.id});
  return Response.json({ok:true,call_id:call.id,ice:await iceServers()});
 }

 if(!uuid.test(String(b.call_id)))return bad('Invalid request');
 const {data:call}=await svc.from('zarn_calls').select('*').eq('id',b.call_id).maybeSingle();
 if(!call||(call.caller_id!==me.user_id&&call.callee_id!==me.user_id))return bad('Call not found.',404);
 const now=new Date().toISOString();

 if(b.action==='answer'){
  if(call.callee_id!==me.user_id)return bad('Only the person being called can answer.',403);
  if(call.status!=='ringing'||Date.now()-new Date(call.created_at).getTime()>RING_MS)return bad('This call has ended.',410);
  await svc.from('zarn_calls').update({status:'active',answered_at:now}).eq('id',call.id).eq('status','ringing');
  return Response.json({ok:true,ice:await iceServers()});
 }

 // decline / end: finish once, and leave a line in the conversation.
 const done=b.action==='decline'&&call.callee_id===me.user_id&&call.status==='ringing'?'declined'
  :call.status==='ringing'?'missed'
  :call.status==='active'?'ended':null;
 if(!done)return Response.json({ok:true});
 const {data:upd}=await svc.from('zarn_calls').update({status:done,ended_at:now}).eq('id',call.id).in('status',['ringing','active']).select('id').maybeSingle();
 if(upd){
  const duration=done==='ended'&&call.answered_at?Math.max(1,Math.round((Date.now()-new Date(call.answered_at).getTime())/1000)):0;
  await svc.from('zarn_messages').insert({channel_id:call.channel_id,kind:'system',meta:{event:'call',status:done,by:call.caller_id,duration}});
  if(done==='missed'&&call.caller_id===me.user_id)await pushTo([call.callee_id],{title:`Missed call from ${me.display_name}`,body:'Tap to open the chat and call back',tag:`missed-${call.id}`,url:`/zarn/c/${call.channel_id}`});
 }
 return Response.json({ok:true});
}
