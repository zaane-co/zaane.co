import 'server-only';
import webpush from 'web-push';
import {serviceClient} from '@/lib/supabase/server';
// Send a web push to every device the given members have allowed notifications on. Dead subscriptions are removed.
export async function pushTo(userIds:string[],payload:Record<string,unknown>){
 const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY;
 if(!pub||!priv||!userIds.length)return 0;
 const svc=serviceClient();
 const {data:subs}=await svc.from('zarn_push_subscriptions').select('endpoint,p256dh,auth').in('user_id',userIds);
 if(!subs?.length)return 0;
 webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:nnamdi@zaane.co',pub,priv);
 let sent=0;
 await Promise.all(subs.map(async s=>{
  try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(payload),{TTL:payload.call?45:86400,urgency:payload.call?'high':'normal'});sent++;}
  catch(e){const code=(e as {statusCode?:number}).statusCode;if(code===404||code===410)await svc.from('zarn_push_subscriptions').delete().eq('endpoint',s.endpoint);}
 }));
 return sent;
}
// STUN is free and always on. With a Cloudflare TURN key set, calls also work across strict networks and mobile data.
export async function iceServers():Promise<RTCIceServer[]>{
 const fallback:RTCIceServer[]=[{urls:'stun:stun.cloudflare.com:3478'}];
 const id=process.env.CF_TURN_KEY_ID,tok=process.env.CF_TURN_API_TOKEN;
 if(!id||!tok)return fallback;
 try{
  const r=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`,{method:'POST',headers:{Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},body:JSON.stringify({ttl:86400})});
  if(!r.ok)return fallback;
  const d=await r.json();const list=Array.isArray(d)?d:d.iceServers;
  return Array.isArray(list)&&list.length?list:fallback;
 }catch{return fallback;}
}
