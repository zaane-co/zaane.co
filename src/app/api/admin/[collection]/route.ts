import {staff,sessionClient} from '@/lib/supabase/server';
import {collections,allowed,safeUrl} from '@/lib/cms';
import {revalidatePath} from 'next/cache';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{collection:string}>}){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const user=await staff();const {collection}=await params;
 if(!user||!allowed(collection,user.role))return Response.json({error:'Access denied'},{status:403});
 const spec=collections[collection];const body=await request.json().catch(()=>null);
 if(!body||!['save','delete'].includes(body.action)||body.id&&!uuid.test(body.id))return Response.json({error:'Invalid request'},{status:400});
 const db=await sessionClient();
 if(body.action==='delete'){
  if(user.role==='editor'||collection==='users'||!body.id)return Response.json({error:'Deletion is not permitted'},{status:403});
  const {error}=await db.from(collection).delete().eq('id',body.id);
  if(error)return Response.json({error:'Could not delete this record.'},{status:400});
 }else{
  if(spec.inbox&&!body.id)return Response.json({error:'Create staff accounts in Supabase Auth; submissions are collected by the public forms.'},{status:400});
  const input=body.values;if(!input||typeof input!=='object')return Response.json({error:'Invalid fields'},{status:400});
  const values:Record<string,unknown>={};
  for(const f of spec.fields){
   let v=input[f.key]??'';
   if(typeof v!=='string'&&typeof v!=='boolean'&&typeof v!=='number')return Response.json({error:`Invalid ${f.label}`},{status:400});
   if(typeof v==='string')v=v.trim();
   if(f.required&&!v)return Response.json({error:`${f.label} is required`},{status:400});
   if(String(v).length>(f.type==='markdown'?100000:10000))return Response.json({error:`${f.label} is too long`},{status:400});
   if(f.options&&!f.options.includes(String(v)))return Response.json({error:`Invalid ${f.label}`},{status:400});
   if(f.key==='slug'&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(v)))return Response.json({error:'Use lowercase letters, numbers and hyphens in the slug.'},{status:400});
   if((f.type==='url'||f.type==='image')&&v&&!safeUrl(v))return Response.json({error:`Use a valid URL for ${f.label}`},{status:400});
   if(f.key.endsWith('_id')&&v&&!uuid.test(String(v)))return Response.json({error:`Select a valid ${f.label}`},{status:400});
   if(f.type==='number'){v=v===''?null:Number(v);if(v!==null&&(!Number.isFinite(v)||!Number.isInteger(v)))return Response.json({error:`${f.label} must be a whole number`},{status:400});}
   if(f.type==='boolean')v=v===true||v==='true';
   if(f.type==='array')v=String(v).split(',').map(s=>s.trim()).filter(Boolean);
   if(f.key.endsWith('_id')||f.key==='role'&&collection==='users')v=v||null;
   values[f.key]=v;
  }
  if(user.role==='editor'&&values.status==='published')return Response.json({error:'An admin must publish this content.'},{status:403});
  if(collection==='users'&&body.id===user.id&&values.role!=='super_admin')return Response.json({error:'Ask another super admin to change your role.'},{status:400});
  if(collection==='settings'&&String(values.key).endsWith('_url')&&values.value&&!safeUrl(values.value))return Response.json({error:'Enter an http or https URL.'},{status:400});
  if(collection==='blog_posts'&&values.status==='published'){
   const {data:old}=body.id?await db.from('blog_posts').select('published_at').eq('id',body.id).single():{data:null};
   values.published_at=old?.published_at||new Date().toISOString();
  }
  if(collection==='blog_posts'&&!body.id)values.author_id=user.id;
  const result=body.id?await db.from(collection).update(values).eq('id',body.id).select('id'):await db.from(collection).insert(values).select('id');
  if(result.error||!result.data?.length)return Response.json({error:result.error?.code==='23505'?'That slug or key already exists.':'Could not save. Check your fields and publishing permissions.'},{status:400});
 }
 revalidatePath('/','layout');return Response.json({ok:true});
}
export async function GET(request:Request,{params}:{params:Promise<{collection:string}>}){
 const user=await staff();const {collection}=await params;
 if(!user||!allowed(collection,user.role)||!['leads','contact_submissions','subscribers'].includes(collection))return new Response('Access denied',{status:403});
 const db=await sessionClient();const {data,error}=await db.from(collection).select('*').order('created_at',{ascending:false}).limit(10000);
 if(error)return new Response('Export failed',{status:500});
 const rows=data||[];const keys=Object.keys(rows[0]||{id:'',email:'',created_at:''});
 const cell=(v:unknown)=>{let s=String(v??'');if(/^[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return new Response([keys.map(cell).join(','),...rows.map(row=>keys.map(k=>cell(row[k])).join(','))].join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${collection}.csv"`,'Cache-Control':'no-store'}});
}
