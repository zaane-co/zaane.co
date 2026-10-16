import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
// Save or remove this device's push subscription for the signed-in member.
const bad=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return bad('Invalid origin',403);
 const me=await zarnMember();if(!me)return bad('Sign in first.',401);
 const b=await request.json().catch(()=>null);const s=b?.subscription;
 if(!s?.endpoint||!s.keys?.p256dh||!s.keys?.auth||typeof s.endpoint!=='string'||!s.endpoint.startsWith('https://'))return bad('Invalid subscription');
 const {error}=await serviceClient().from('zarn_push_subscriptions').upsert({endpoint:s.endpoint,user_id:me.user_id,p256dh:s.keys.p256dh,auth:s.keys.auth});
 if(error)return bad('Could not save.',500);
 return Response.json({ok:true});
}
export async function DELETE(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return bad('Invalid origin',403);
 const me=await zarnMember();if(!me)return bad('Sign in first.',401);
 const b=await request.json().catch(()=>null);if(typeof b?.endpoint!=='string')return bad('Invalid request');
 await serviceClient().from('zarn_push_subscriptions').delete().eq('endpoint',b.endpoint).eq('user_id',me.user_id);
 return Response.json({ok:true});
}
