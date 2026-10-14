import {serviceClient} from '@/lib/supabase/server';
import {livePost,sameOrigin,clientIp,allow,uuid} from '@/lib/blog-public';
// POST {post_id} records a view and returns its id; POST {post_id,view_id,read_duration_seconds} (sent as a beacon on leave) adds the read time.
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid origin'},{status:403});
 const body=await request.json().catch(()=>null);if(!body)return Response.json({ok:true});
 const db=serviceClient();
 if(body.view_id!=null){
  const secs=Math.round(Number(body.read_duration_seconds));
  if(!uuid.test(String(body.view_id))||!Number.isFinite(secs)||secs<3||secs>86400)return Response.json({ok:true});
  await db.from('blog_post_views').update({read_duration_seconds:secs}).eq('id',body.view_id).eq('post_id',body.post_id).is('read_duration_seconds',null);
  return Response.json({ok:true});
 }
 if(!await livePost(body.post_id))return Response.json({ok:true});
 if(!await allow('view',clientIp(request),String(body.post_id)))return Response.json({ok:true});
 const {data}=await db.from('blog_post_views').insert({post_id:body.post_id,country:request.headers.get('x-vercel-ip-country')}).select('id').single();
 return Response.json({ok:true,id:data?.id??null});
}
