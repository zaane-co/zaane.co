import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {r2Configured,signGet,signPut} from '@/lib/r2';
import {fileKindOk,formFilePrefix,readForm} from '@/lib/form';
// File upload questions. POST gives the person answering a short-lived link to upload one file straight to storage
// (so big files skip the server); GET lets the form's owners and editors download a file from a response.
const body=z.object({id:z.uuid(),q:z.string().min(1).max(20),name:z.string().min(1).max(255),type:z.string().max(150),size:z.number().int().positive()});
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 if(!r2Configured())return fail('File uploads aren’t set up yet.',503);
 const parsed=body.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail('Invalid request');
 const b=parsed.data;
 const {data:doc}=await serviceClient().from('zarn_docs').select('kind,content,trashed_at').eq('id',b.id).maybeSingle();
 if(!doc||doc.kind!=='form'||doc.trashed_at)return fail('This form isn’t available.',404);
 const f=readForm(doc.content);
 if(!f.set.open)return fail('This form is no longer taking answers.',403);
 if(f.set.who==='team'){const me=await zarnMember().catch(()=>null);if(!me||me.account_type!=='member')return fail('Sign in to ZARN to answer this form.',401);}
 const q=f.qs.find(x=>x.id===b.q&&x.t==='file');if(!q)return fail('This question doesn’t take files.');
 if(!fileKindOk(q,b.name,b.type))return fail(`${b.name} isn’t a file type this question takes.`);
 if(b.size>(q.maxMb??100)*1048576)return fail(`${b.name} is too big for this question.`);
 const ext=(b.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]??'').toLowerCase();
 const slug=b.name.toLowerCase().replace(/\.[a-z0-9]{1,8}$/i,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,60)||'file';
 const key=`${formFilePrefix(b.id,q.id)}${crypto.randomUUID()}-${slug}${ext?`.${ext}`:''}`;
 const type=b.type||'application/octet-stream';
 return Response.json({key,type,url:await signPut(key,type)});
}
export async function GET(request:Request){
 const u=new URL(request.url),id=u.searchParams.get('id')??'',key=u.searchParams.get('k')??'',name=u.searchParams.get('n')||'file';
 if(!z.uuid().safeParse(id).success||!key.startsWith(`private/zarn/forms/${id}/`)||key.includes('..'))return fail('Not found.',404);
 const me=await zarnMember().catch(()=>null);if(!me)return fail('Sign in to ZARN.',401);
 const {data:role}=await me.db.rpc('zarn_doc_role',{d:id});
 if(role!=='owner'&&role!=='edit')return fail('Only the form’s owners and editors can open answers.',403);
 return Response.redirect(await signGet(key,name),302);
}
