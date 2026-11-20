import {z} from 'zod';
import {createHash} from 'node:crypto';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {pushTo} from '@/lib/zarn-push';
import {checkAnswers,leadFrom,readForm} from '@/lib/form';
// Someone answering a form. Public forms take answers from anyone with the link; team forms need a ZARN sign-in.
const body=z.object({id:z.uuid(),answers:z.record(z.string(),z.unknown()),email:z.string().max(200).optional(),hp:z.string().optional()});
const fail=(error:string,status=400)=>Response.json({error},{status});
// Sends from one network address: at most 10 to a form in 10 minutes, and 60 to all forms in an hour.
const ipHash=(req:Request)=>{const ip=(req.headers.get('x-forwarded-for')??'').split(',')[0].trim()||req.headers.get('x-real-ip')||'';return ip?createHash('sha256').update(`zarn-forms:${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-12)??''}:${ip}`).digest('hex').slice(0,32):null;};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const parsed=body.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail('Invalid request');
 const b=parsed.data;
 // A hidden field people never see; bots fill it in. Pretend it worked.
 if(b.hp)return Response.json({ok:true});
 const db=serviceClient();
 const {data:doc}=await db.from('zarn_docs').select('id,title,kind,content,owner_id,trashed_at').eq('id',b.id).maybeSingle();
 if(!doc||doc.kind!=='form'||doc.trashed_at)return fail('This form isn’t available.',404);
 const f=readForm(doc.content);
 if(!f.set.open)return fail('This form is no longer taking answers.',403);
 const me=await zarnMember().catch(()=>null);
 if(f.set.who==='team'&&(!me||me.account_type!=='member'))return fail('Sign in to ZARN to answer this form.',401);
 if(f.set.once&&me){const {count}=await db.from('zarn_form_responses').select('id',{count:'exact',head:true}).eq('doc_id',b.id).eq('user_id',me.user_id);if(count)return fail('You’ve already answered this form.',409);}
 let email:string|null=null;
 if(f.set.email&&!me){email=(b.email??'').trim().toLowerCase();if(!EMAIL.test(email))return fail('Enter a valid email address.');}
 const chk=checkAnswers(f,b.answers);if(!chk.ok)return fail(chk.error);
 const ip=ipHash(request);
 if(ip&&!me){
  const since=(ms:number)=>new Date(Date.now()-ms).toISOString();
  const [{count:here},{count:all}]=await Promise.all([
   db.from('zarn_form_responses').select('id',{count:'exact',head:true}).eq('ip_hash',ip).eq('doc_id',b.id).gt('created_at',since(600_000)),
   db.from('zarn_form_responses').select('id',{count:'exact',head:true}).eq('ip_hash',ip).gt('created_at',since(3_600_000))]);
  if((here??0)>=10||(all??0)>=60)return fail('Too many answers from your connection. Try again a little later.',429);
 }
 const {error}=await db.from('zarn_form_responses').insert({doc_id:b.id,user_id:me?.user_id??null,email,ip_hash:ip,answers:chk.clean});
 if(error)return fail('Could not send your answers. Try again.',500);
 if(f.set.notify&&doc.owner_id!==me?.user_id)await pushTo([doc.owner_id],{title:`New response to ${doc.title||'your form'}`,body:me?`From ${me.display_name}`:email?`From ${email}`:'Someone answered your form',tag:`form-${b.id}`,url:`/zarn/forms/${b.id}?tab=responses`}).catch(()=>0);
 if(f.set.lead)await captureLead(db,b.id,doc.owner_id,doc.title,leadFrom(f,chk.clean,email)).catch(()=>0);
 return Response.json({ok:true});
}
// Forms set to capture leads add a new lead to ZARN Business and tell the admins.
// Only forms owned by a ZARN admin can do this, so nobody else can add leads.
async function captureLead(db:ReturnType<typeof serviceClient>,form:string,owner:string,title:string,l:ReturnType<typeof leadFrom>){
 const mail=EMAIL.test(l.email)?l.email:'';if(!mail&&!l.name)return;
 const [{data:m},{data:u}]=await Promise.all([db.from('zarn_members').select('is_admin').eq('user_id',owner).maybeSingle(),db.from('users').select('role').eq('id',owner).maybeSingle()]);
 if(!m?.is_admin&&u?.role!=='super_admin')return;
 // The company is filed under Companies (matched by name), and a new deal goes on the board.
 let co:{id:string;name:string}|null=null;
 if(l.company){const {data:found}=await db.from('zarn_biz_companies').select('id,name').ilike('name',l.company.replace(/[%_\\]/g,m=>`\\${m}`)).limit(1).maybeSingle();
  co=found??(await db.from('zarn_biz_companies').insert({name:l.company.trim()}).select('id,name').single()).data;}
 const {data,error}=await db.from('zarn_biz_contacts').insert({name:l.name||mail,email:mail,company:co?.name??'',company_id:co?.id??null,phone:l.phone,note:l.message,source:'form',form_id:form}).select('id').single();
 if(error)return;
 await db.from('zarn_biz_deals').insert({title:co?.name||l.name||mail,contact_id:data.id,company_id:co?.id??null,stage:'new',position:Date.now(),note:l.message.slice(0,5000)});
 const {data:admins}=await db.from('zarn_members').select('user_id').eq('is_admin',true);
 await pushTo((admins??[]).map(a=>a.user_id),{title:'New lead',body:`${l.name||mail}${l.company?` · ${l.company}`:''} via ${title||'a form'}`,tag:`lead-${data.id}`,url:`/zarn/business/contacts?c=${data.id}`}).catch(()=>0);
}
