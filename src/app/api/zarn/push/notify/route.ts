import webpush from 'web-push';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {channelHref} from '@/lib/zarn';
export const maxDuration=30;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Called by the sender's browser right after a message is saved. Pushes it to the other members' phones and desktops.
// DMs and client spaces notify everyone; channels only notify people who were @mentioned. Muted conversations only notify on @mentions.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await zarnMember();if(!me)return Response.json({error:'Sign in first.'},{status:401});
 const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY;
 if(!pub||!priv)return Response.json({ok:true,sent:0});
 const b=await request.json().catch(()=>null);if(!b||!uuid.test(String(b.message_id)))return Response.json({error:'Invalid request'},{status:400});
 // The sender's own session must be able to see their own message.
 const {data:m}=await me.db.from('zarn_messages').select('id,channel_id,user_id,body,kind,parent_id,attachments,created_at').eq('id',b.message_id).maybeSingle();
 if(!m||m.user_id!==me.user_id||m.kind!=='user'||Date.now()-new Date(m.created_at).getTime()>5*60*1000)return Response.json({ok:true,sent:0});
 const svc=serviceClient();
 const [{data:ch},{data:mem},{data:people}]=await Promise.all([
  svc.from('zarn_channels').select('id,name,kind,lead_id').eq('id',m.channel_id).single(),
  svc.from('zarn_channel_members').select('user_id,muted').eq('channel_id',m.channel_id).neq('user_id',me.user_id),
  svc.from('zarn_members').select('user_id,display_name').is('deactivated_at',null),
 ]);
 if(!ch||!mem?.length)return Response.json({ok:true,sent:0});
 const names=Object.fromEntries((people??[]).map(p=>[p.user_id,p.display_name]));
 const text=String(m.body??'').replace(/<@([0-9a-f-]{36})>/gi,(_,id)=>`@${names[id]??'someone'}`).replace(/<!channel>/g,'@channel').replace(/[*_~`]/g,'').trim();
 const body=(text||(((m.attachments as {type?:string}[]|null)?.[0]?.type?.startsWith('audio/')?'Voice note':(m.attachments as unknown[]|null)?.length?'Sent an attachment':''))).slice(0,140);
 const who=names[me.user_id]??'ZARN';
 const title=(ch.kind==='dm'?who:ch.kind==='client'?`${who} in a client space`:`${who} in #${ch.name??''}`)+(m.parent_id?' · thread':'');
 const everyone=String(m.body).includes('<!channel>');
 const targets=mem.filter(r=>{const mention=everyone||String(m.body).includes(`<@${r.user_id}>`);return mention||(!r.muted&&(ch.kind==='dm'||ch.kind==='client'));}).map(r=>r.user_id).filter(u=>names[u]);
 if(!targets.length)return Response.json({ok:true,sent:0});
 const {data:subs}=await svc.from('zarn_push_subscriptions').select('endpoint,p256dh,auth,user_id').in('user_id',targets);
 if(!subs?.length)return Response.json({ok:true,sent:0});
 webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:nnamdi@zaane.co',pub,priv);
 const url=channelHref(ch,ch.id);
 const counts=new Map<string,number>();
 await Promise.all([...new Set(subs.map(s=>s.user_id))].map(async u=>{const {data}=await svc.rpc('zarn_unread_total',{uid:u});counts.set(u,Number(data)||1);}));
 let sent=0;
 await Promise.all(subs.map(async s=>{
  try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body:body||'New message',tag:m.id,url,channel:ch.id,unread:counts.get(s.user_id)??1}),{TTL:60*60*24});sent++;}
  catch(e){const code=(e as {statusCode?:number}).statusCode;if(code===404||code===410)await svc.from('zarn_push_subscriptions').delete().eq('endpoint',s.endpoint);}
 }));
 return Response.json({ok:true,sent});
}
