import {staff,sessionClient} from '@/lib/supabase/server';
import {isAdmin} from '@/lib/cms';
import {projectTaxonomy} from '@/lib/cms';
import {revalidatePath} from 'next/cache';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Admins add, rename and remove project categories (category, subcategory, selected-work tab).
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const user=await staff();if(!user||!isAdmin(user.role))return Response.json({error:'An admin must manage project categories.'},{status:403});
 const body=await request.json().catch(()=>null);if(!body)return Response.json({error:'Invalid request'},{status:400});
 const db=await sessionClient(),name=typeof body.name==='string'?body.name.trim().replace(/\s+/g,' '):'';
 if(body.action==='create'){
  if(!projectTaxonomy.includes(body.kind))return Response.json({error:'Invalid request'},{status:400});
  if(!name||name.length>80)return Response.json({error:'Enter a name (up to 80 characters).'},{status:400});
  const {data,error}=await db.from('project_categories').insert({kind:body.kind,name}).select('*').single();
  if(error)return Response.json({error:error.code==='23505'?'That one already exists.':'Could not add it.'},{status:400});
  revalidatePath('/','layout');return Response.json(data);
 }
 if(!uuid.test(String(body.id)))return Response.json({error:'Invalid request'},{status:400});
 const {data:old}=await db.from('project_categories').select('*').eq('id',body.id).maybeSingle();
 if(!old)return Response.json({error:'Not found.'},{status:404});
 if(body.action==='rename'){
  if(!name||name.length>80)return Response.json({error:'Enter a name (up to 80 characters).'},{status:400});
  const {data,error}=await db.from('project_categories').update({name}).eq('id',old.id).select('*').single();
  if(error)return Response.json({error:error.code==='23505'?'That one already exists.':'Could not rename it.'},{status:400});
  // Keep projects that used the old name pointing at the new one.
  const column=String(old.kind);
  await db.from('projects').update({[column]:name} as Record<string,string>).eq(column,old.name);
  revalidatePath('/','layout');return Response.json(data);
 }
 if(body.action==='delete'){
  const {count}=await db.from('projects').select('id',{count:'exact',head:true}).eq(String(old.kind),old.name);
  if(count)return Response.json({error:`${count} project${count>1?'s use':' uses'} “${old.name}”. Move ${count>1?'them':'it'} to another option first.`},{status:400});
  const {error}=await db.from('project_categories').delete().eq('id',old.id);if(error)return Response.json({error:'Could not delete it.'},{status:400});
  revalidatePath('/','layout');return Response.json({ok:true});
 }
 return Response.json({error:'Invalid request'},{status:400});
}
