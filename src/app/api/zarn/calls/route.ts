import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {iceServers,pushTo} from '@/lib/zarn-push';
// Call state: start, join, decline, leave, invite and a heartbeat. Audio and video never touch this route: they go
// straight between the people in the call. A call is open while anyone is in it; one-to-one calls end when either side leaves.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad=(error:string,status=400)=>Response.json({error},{status});
const RING_MS=60_000,STALE_MS=80_000,MAX_RING=50;
type Svc=ReturnType<typeof serviceClient>;
type CallRow={id:string;channel_id:string;caller_id:string;callee_id:string|null;status:string;kind:string;video:boolean;created_at:string;answered_at:string|null};
const ago=(ms:number)=>new Date(Date.now()-ms).toISOString();
const live=(c:CallRow|null)=>!!c&&(c.status==='ringing'||c.status==='active');

// Finish a call once: mark who never answered, and leave a line in the chat.
async function close(svc:Svc,call:CallRow,status:'ended'|'missed'|'declined',by:string){
 const now=new Date().toISOString();
 const {data:upd}=await svc.from('zarn_calls').update({status,ended_at:now}).eq('id',call.id).in('status',['ringing','active']).select('id').maybeSingle();
 if(!upd)return;
 await svc.from('zarn_call_people').update({status:'missed'}).eq('call_id',call.id).eq('status','ringing');
 await svc.from('zarn_call_people').update({status:'left',left_at:now}).eq('call_id',call.id).eq('status','joined');
 const duration=status==='ended'&&call.answered_at?Math.max(1,Math.round((Date.now()-new Date(call.answered_at).getTime())/1000)):0;
 await svc.from('zarn_messages').insert({channel_id:call.channel_id,kind:'system',meta:{event:'call',status,by:call.caller_id,duration,video:call.video,group:call.kind==='group'}});
 if(status==='missed'&&call.kind==='direct'&&call.callee_id&&by===call.caller_id){
  const {data:who}=await svc.from('zarn_members').select('display_name').eq('user_id',call.caller_id).maybeSingle();
  await pushTo([call.callee_id],{title:`Missed call from ${who?.display_name??'a teammate'}`,body:'Tap to open the chat and call back',tag:`missed-${call.id}`,url:`/zarn/c/${call.channel_id}`}).catch(()=>0);
 }
}
// Drop people whose tab closed without leaving, stop ringing that timed out, and close the call if nobody is left.
async function settle(svc:Svc,id:string,by:string){
 await svc.from('zarn_call_people').update({status:'left',left_at:new Date().toISOString()}).eq('call_id',id).eq('status','joined').lt('seen_at',ago(STALE_MS));
 await svc.from('zarn_call_people').update({status:'missed'}).eq('call_id',id).eq('status','ringing').lt('created_at',ago(RING_MS));
 const {data:call}=await svc.from('zarn_calls').select('*').eq('id',id).maybeSingle() as {data:CallRow|null};
 if(!call||!live(call))return null;
 const {count}=await svc.from('zarn_call_people').select('user_id',{count:'exact',head:true}).eq('call_id',id).eq('status','joined');
 if(!count){await close(svc,call,call.answered_at?'ended':'missed',by);return null;}
 return call;
}
// Ring people: a fresh ring row each time (so ringing again works), then a push to their devices.
async function ring(svc:Svc,call:CallRow,ids:string[],me:{user_id:string;display_name:string},place:string){
 if(!ids.length)return;
 const now=new Date().toISOString();
 const {data:have}=await svc.from('zarn_call_people').select('user_id,status').eq('call_id',call.id).in('user_id',ids);
 const inCall=new Set((have??[]).filter(r=>r.status==='joined').map(r=>r.user_id));
 const rows=ids.filter(u=>!inCall.has(u)).map(u=>({call_id:call.id,user_id:u,status:'ringing',invited_by:me.user_id,created_at:now,joined_at:null,left_at:null}));
 if(!rows.length)return;
 await svc.from('zarn_call_people').upsert(rows,{onConflict:'call_id,user_id'});
 const kind=call.video?'Video':'Voice';
 await pushTo(rows.map(r=>r.user_id),{title:call.kind==='direct'?`${me.display_name} is calling`:`${me.display_name} is calling ${place}`,body:`${kind} call · tap to join`,tag:`call-${call.id}`,url:`/zarn/call/${call.id}`,call:call.id}).catch(()=>0);
}
async function placeName(svc:Svc,channel:string){
 const {data:ch}=await svc.from('zarn_channels').select('kind,name').eq('id',channel).maybeSingle();
 return ch?.kind==='dm'?'the group':ch?.name?`#${ch.name}`:'the team';
}

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return bad('Invalid origin',403);
 const me=await zarnMember();if(!me)return bad('Sign in first.',401);
 const b=await request.json().catch(()=>null);
 if(!b||!['start','join','decline','leave','beat','invite'].includes(b.action))return bad('Invalid request');
 const svc=serviceClient(),now=new Date().toISOString();

 if(b.action==='start'){
  if(!uuid.test(String(b.channel_id)))return bad('Invalid request');
  const {data:ch}=await svc.from('zarn_channels').select('id,kind,name').eq('id',b.channel_id).maybeSingle();
  const {data:mine}=await svc.from('zarn_channel_members').select('user_id').eq('channel_id',b.channel_id).eq('user_id',me.user_id).maybeSingle();
  if(!ch||!mine)return bad('Join this chat to call it.',403);
  // A call is already going on here: join it instead of starting another.
  const {data:open}=await svc.from('zarn_calls').select('id').eq('channel_id',ch.id).in('status',['ringing','active']).order('created_at',{ascending:false}).limit(1);
  if(open?.[0]){const c=await settle(svc,open[0].id,me.user_id);if(c)return Response.json({ok:true,existing:true,call_id:c.id});}
  const {data:mem}=await svc.from('zarn_channel_members').select('user_id').eq('channel_id',ch.id).neq('user_id',me.user_id).limit(500);
  const {data:active}=await svc.from('zarn_members').select('user_id').in('user_id',(mem??[]).map(m=>m.user_id)).is('deactivated_at',null);
  let others=(active??[]).map(m=>m.user_id);
  if(Array.isArray(b.user_ids)&&b.user_ids.length){const pick=new Set(b.user_ids.map(String));others=others.filter(u=>pick.has(u));}
  if(!others.length)return bad('There’s nobody else in this chat to call.');
  const direct=ch.kind==='dm'&&others.length===1;
  if(direct){
   const {data:busy}=await svc.from('zarn_call_people').select('call_id').eq('user_id',others[0]).eq('status','joined').gt('seen_at',ago(STALE_MS)).limit(1);
   if(busy?.length)return bad('They’re on another call right now.',409);
  }
  const video=b.video===true;
  const {data:call,error}=await svc.from('zarn_calls').insert({channel_id:ch.id,caller_id:me.user_id,callee_id:direct?others[0]:null,video,kind:direct?'direct':'group',status:direct?'ringing':'active'}).select('*').single();
  if(error||!call)return bad('Could not start the call.',500);
  await svc.from('zarn_call_people').insert({call_id:call.id,user_id:me.user_id,status:'joined',joined_at:now,seen_at:now});
  await ring(svc,call as CallRow,others.slice(0,MAX_RING),me,ch.kind==='dm'?'the group':ch.name?`#${ch.name}`:'the team');
  return Response.json({ok:true,call_id:call.id,kind:call.kind,video,channel_id:ch.id,caller_id:me.user_id,ice:await iceServers()});
 }

 if(!uuid.test(String(b.call_id)))return bad('Invalid request');
 const {data:call}=await svc.from('zarn_calls').select('*').eq('id',b.call_id).maybeSingle() as {data:CallRow|null};
 if(!call)return bad('Call not found.',404);
 const {data:row}=await svc.from('zarn_call_people').select('status').eq('call_id',call.id).eq('user_id',me.user_id).maybeSingle();

 if(b.action==='join'){
  // Invited people and members of the chat can join; any team member can join from a shared link.
  const {data:inCh}=await svc.from('zarn_channel_members').select('user_id').eq('channel_id',call.channel_id).eq('user_id',me.user_id).maybeSingle();
  if(!row&&!inCh&&me.account_type!=='member')return bad('Ask someone in the call to add you.',403);
  const c=await settle(svc,call.id,me.user_id);if(!c)return bad('This call has ended.',410);
  await svc.from('zarn_call_people').upsert({call_id:c.id,user_id:me.user_id,status:'joined',joined_at:now,seen_at:now,left_at:null},{onConflict:'call_id,user_id'});
  if(!c.answered_at&&me.user_id!==c.caller_id)await svc.from('zarn_calls').update({status:'active',answered_at:now}).eq('id',c.id).is('answered_at',null);
  return Response.json({ok:true,call_id:c.id,kind:c.kind,video:c.video,channel_id:c.channel_id,caller_id:c.caller_id,ice:await iceServers()});
 }
 if(!row)return bad('Call not found.',404);

 if(b.action==='beat'){
  if(row.status!=='joined'||!live(call))return Response.json({ok:false,ended:true});
  await svc.from('zarn_call_people').update({seen_at:now}).eq('call_id',call.id).eq('user_id',me.user_id);
  return Response.json({ok:true});
 }
 if(b.action==='decline'){
  if(row.status!=='ringing')return Response.json({ok:true});
  await svc.from('zarn_call_people').update({status:'declined'}).eq('call_id',call.id).eq('user_id',me.user_id);
  if(call.kind==='direct'&&live(call))await close(svc,call,'declined',me.user_id);
  return Response.json({ok:true});
 }
 if(b.action==='leave'){
  await svc.from('zarn_call_people').update({status:'left',left_at:now}).eq('call_id',call.id).eq('user_id',me.user_id).eq('status','joined');
  if(!live(call))return Response.json({ok:true});
  // One-to-one calls end when either person hangs up; group calls end when the last person leaves.
  if(call.kind==='direct')await close(svc,call,call.answered_at?'ended':'missed',me.user_id);
  else await settle(svc,call.id,me.user_id);
  return Response.json({ok:true});
 }
 // invite: someone in the call rings more people. A one-to-one call becomes a group call.
 if(row.status!=='joined'||!live(call))return bad('Join the call to add people.',403);
 const ids=Array.isArray(b.user_ids)?[...new Set((b.user_ids as unknown[]).map(String).filter(u=>uuid.test(u)))].slice(0,MAX_RING):[];
 if(!ids.length)return bad('Pick someone to add.');
 const {data:ok}=await svc.from('zarn_members').select('user_id').in('user_id',ids).is('deactivated_at',null).eq('account_type','member');
 if(!ok?.length)return bad('Those people can’t be added.');
 if(call.kind==='direct'){await svc.from('zarn_calls').update({kind:'group',status:'active'}).eq('id',call.id);call.kind='group';}
 await ring(svc,call,ok.map(m=>m.user_id),me,await placeName(svc,call.channel_id));
 return Response.json({ok:true});
}
