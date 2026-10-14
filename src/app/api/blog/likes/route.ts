import {serviceClient} from '@/lib/supabase/server';
import {livePost,sameOrigin,clientIp,allow,uuid} from '@/lib/blog-public';
const validFp=(v:unknown):v is string=>typeof v==='string'&&uuid.test(v);
async function state(postId:string,fp?:string){
 const db=serviceClient();
 const [{count},{data}]=await Promise.all([
  db.from('blog_likes').select('id',{count:'exact',head:true}).eq('post_id',postId),
  fp?db.from('blog_likes').select('id').eq('post_id',postId).eq('fingerprint',fp).maybeSingle():Promise.resolve({data:null}),
 ]);
 return {count:count??0,liked:!!data};
}
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,postId=q.get('post_id'),fp=q.get('fingerprint');
 if(!postId||!uuid.test(postId))return Response.json({count:0,liked:false});
 return Response.json(await state(postId,validFp(fp)?fp:undefined));
}
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid origin'},{status:403});
 const body=await request.json().catch(()=>null);
 if(!body||!validFp(body.fingerprint)||!await livePost(body.post_id))return Response.json({error:'Invalid request'},{status:400});
 if(!await allow('like',clientIp(request),body.post_id))return Response.json({...await state(body.post_id,body.fingerprint),error:'Slow down a little.'},{status:429});
 const db=serviceClient();
 const {data:existing}=await db.from('blog_likes').select('id').eq('post_id',body.post_id).eq('fingerprint',body.fingerprint).maybeSingle();
 if(existing)await db.from('blog_likes').delete().eq('id',existing.id);
 else await db.from('blog_likes').insert({post_id:body.post_id,fingerprint:body.fingerprint});
 return Response.json(await state(body.post_id,body.fingerprint));
}
