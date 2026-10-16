import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
// Task statuses are the board columns. Anyone on the team can add one; the person who added it (or an admin) can delete it,
// and tasks in a deleted status move back to To-do. The four built-in statuses stay.
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('add'),label:z.string().trim().min(1).max(30),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}),
 z.object({action:z.literal('delete'),key:z.string().regex(/^[a-z0-9_]{1,48}$/)}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in first.',401);
 if(me.account_type==='guest')return fail('Guests can’t change statuses.',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail('Invalid request');
 const b=parsed.data,db=serviceClient();
 if(b.action==='add'){
  const {data:all}=await db.from('zarn_task_statuses').select('label,position');
  if((all??[]).some(s=>s.label.toLowerCase()===b.label.toLowerCase()))return fail('A status with that name already exists.');
  if((all?.length??0)>=15)return fail('You can have up to 15 statuses.');
  const slug=b.label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,30)||'status';
  const key=`${slug}_${Math.random().toString(36).slice(2,6)}`;
  const position=Math.max(0,...(all??[]).map(s=>s.position))+1;
  const {error}=await db.from('zarn_task_statuses').insert({key,label:b.label,color:b.color,position,created_by:me.user_id});
  return error?fail('Could not add the status.'):Response.json({ok:true,key});
 }
 const {data:st}=await db.from('zarn_task_statuses').select('key,builtin,created_by').eq('key',b.key).maybeSingle();
 if(!st)return fail('That status no longer exists.',404);
 if(st.builtin)return fail('The built-in statuses can’t be deleted.');
 const admin=me.staffRole==='super_admin'||me.staffRole==='admin';
 if(st.created_by!==me.user_id&&!admin)return fail('Only the person who added it, or an admin, can delete this status.',403);
 await db.from('zarn_tasks').update({status:'todo'}).eq('status',b.key);
 const {error}=await db.from('zarn_task_statuses').delete().eq('key',b.key);
 return error?fail('Could not delete the status.'):Response.json({ok:true});
}
