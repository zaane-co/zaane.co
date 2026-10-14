import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {safeUrl} from '@/lib/cms';
import {revalidatePath} from 'next/cache';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Gallery images edited inside the project drawer: add several, reorder by drag, remove. RLS limits editors to draft/review projects.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 {const u=await staff();if(!u||!allowed('projects',u.role))return Response.json({error:'Access denied'},{status:403});}
 const body=await request.json().catch(()=>null);
 if(!body||!uuid.test(String(body.project_id)))return Response.json({error:'Invalid request'},{status:400});
 const db=await sessionClient(),project_id=body.project_id as string;
 const list=async()=>(await db.from('project_images').select('id,image_url,order').eq('project_id',project_id).order('order').order('created_at')).data??[];
 let error=null;
 if(body.action==='add'){
  const urls=(Array.isArray(body.urls)?body.urls:[]).filter((u:unknown)=>typeof u==='string'&&/^https?:/.test(u)&&safeUrl(u)).slice(0,50) as string[];
  if(!urls.length)return Response.json({error:'Choose at least one image.'},{status:400});
  const start=(await list()).reduce((m,r)=>Math.max(m,r.order+1),0);
  ({error}=await db.from('project_images').insert(urls.map((image_url,i)=>({project_id,image_url,order:start+i}))));
 }else if(body.action==='reorder'){
  const ids=(Array.isArray(body.ids)?body.ids:[]).filter((i:unknown)=>typeof i==='string'&&uuid.test(i)) as string[];
  for(const [i,id] of ids.entries()){({error}=await db.from('project_images').update({order:i}).eq('id',id).eq('project_id',project_id));if(error)break;}
 }else if(body.action==='remove'){
  if(!uuid.test(String(body.id)))return Response.json({error:'Invalid request'},{status:400});
  ({error}=await db.from('project_images').delete().eq('id',body.id).eq('project_id',project_id));
 }else return Response.json({error:'Invalid request'},{status:400});
 if(error)return Response.json({error:'Could not update the gallery. Check your publishing permissions.'},{status:400});
 revalidatePath('/','layout');
 return Response.json(await list());
}
