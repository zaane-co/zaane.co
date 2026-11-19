import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {pushTo} from '@/lib/zarn-push';
import {checkAnswers,readForm} from '@/lib/form';
// Someone answering a form. Public forms take answers from anyone with the link; team forms need a ZARN sign-in.
const body=z.object({id:z.uuid(),answers:z.record(z.string(),z.unknown()),email:z.string().max(200).optional(),hp:z.string().optional()});
const fail=(error:string,status=400)=>Response.json({error},{status});
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
 const {error}=await db.from('zarn_form_responses').insert({doc_id:b.id,user_id:me?.user_id??null,email,answers:chk.clean});
 if(error)return fail('Could not send your answers. Try again.',500);
 if(f.set.notify&&doc.owner_id!==me?.user_id)await pushTo([doc.owner_id],{title:`New response to ${doc.title||'your form'}`,body:me?`From ${me.display_name}`:email?`From ${email}`:'Someone answered your form',tag:`form-${b.id}`,url:`/zarn/forms/${b.id}?tab=responses`}).catch(()=>0);
 return Response.json({ok:true});
}
