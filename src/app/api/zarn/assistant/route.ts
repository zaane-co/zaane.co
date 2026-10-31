import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {aiConfigured,execute,turn} from '@/lib/zarn-ai';
export const maxDuration=60;
// Pasted documents can be long. The model gets the whole text for the turn; the saved chat keeps a shorter copy
// (the column holds 8000 characters), and older long messages are trimmed when they are replayed as history.
const MAX_MESSAGE=60000,STORED=7500,REPLAYED=3000;
const clip=(t:string,n:number)=>t.length>n?`${t.slice(0,n)}\n[…${(t.length-n).toLocaleString('en-GB')} more characters not kept in this chat]`:t;
const fail=(error:string,status=400)=>Response.json({error},{status});
const body=z.discriminatedUnion('action',[
 z.object({action:z.literal('chat'),conversation_id:z.uuid().optional(),message:z.string().trim().min(1).max(MAX_MESSAGE)}),
 z.object({action:z.literal('confirm'),message_id:z.uuid()}),
 z.object({action:z.literal('cancel'),message_id:z.uuid()}),
]);
// Conversations are stored per person (row-level security), and a confirmed action always runs from the proposal
// the server saved, never from anything the browser sends back.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in to ZARN first.',401);
 if(me.account_type==='guest')return fail('The assistant is for team members.',403);
 const parsed=body.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail('Invalid request');
 const b=parsed.data;

 if(b.action==='confirm'||b.action==='cancel'){
  const {data:row}=await me.db.from('zarn_ai_messages').select('id,conversation_id,proposal,state').eq('id',b.message_id).maybeSingle();
  const proposal=row?.proposal as {tool:string;args:unknown}|null;
  if(!row||!proposal||row.state!=='pending')return fail('That action was already handled.');
  if(b.action==='cancel'){await me.db.from('zarn_ai_messages').update({state:'cancelled'}).eq('id',row.id);return Response.json({ok:true});}
  try{
   const out=await execute(me,proposal.tool,proposal.args);
   await me.db.from('zarn_ai_messages').update({state:'done'}).eq('id',row.id);
   const {data:saved}=await me.db.from('zarn_ai_messages').insert({conversation_id:row.conversation_id,user_id:me.user_id,role:'assistant',content:out.reply}).select('id').single();
   await me.db.from('zarn_ai_conversations').update({updated_at:new Date().toISOString()}).eq('id',row.conversation_id);
   return Response.json({reply:out.reply,message_id:saved?.id,posted:out.posted});
  }catch(e){return fail(e instanceof z.ZodError?'That action is no longer valid. Ask again.':e instanceof Error?e.message:'Could not do that.');}
 }

 if(!aiConfigured())return fail('The assistant isn’t set up yet. An admin needs to add the Cloudflare AI token.',503);
 const cap=Number(process.env.ZARN_AI_DAILY_CAP)||40;
 const {data:allowed,error:limitError}=await serviceClient().rpc('zarn_ai_consume',{uid:me.user_id,cap});
 if(limitError)return fail('The assistant isn’t available right now.',503);
 if(!allowed)return fail(`You’ve used today’s ${cap} assistant requests. It resets tomorrow.`,429);

 let conversation=b.conversation_id;
 if(conversation){
  const {data}=await me.db.from('zarn_ai_conversations').select('id').eq('id',conversation).maybeSingle();
  if(!data)conversation=undefined;
 }
 if(!conversation){
  const {data,error}=await me.db.from('zarn_ai_conversations').insert({user_id:me.user_id,title:b.message.replace(/\s+/g,' ').slice(0,60)}).select('id').single();
  if(error||!data)return fail('Could not start a conversation.',503);
  conversation=data.id as string;
 }
 const {data:userRow}=await me.db.from('zarn_ai_messages').insert({conversation_id:conversation,user_id:me.user_id,role:'user',content:clip(b.message,STORED)}).select('id').single();
 const [{data:past},{data:mem}]=await Promise.all([
  me.db.from('zarn_ai_messages').select('role,content').eq('conversation_id',conversation).order('created_at',{ascending:false}).limit(16),
  me.db.from('zarn_ai_memories').select('fact').order('created_at').limit(30),
 ]);
 const history=((past??[]) as {role:'user'|'assistant';content:string}[]).reverse().filter(m=>m.content).map(m=>({...m,content:clip(m.content,REPLAYED)}));
 // The message just sent goes to the model in full.
 if(history.length&&history[history.length-1].role==='user')history[history.length-1].content=b.message;
 try{
  const out=await turn(me,history,((mem??[]) as {fact:string}[]).map(m=>m.fact));
  const {data:saved}=await me.db.from('zarn_ai_messages').insert({conversation_id:conversation,user_id:me.user_id,role:'assistant',content:out.reply,proposal:out.proposal??null,state:out.proposal?'pending':null}).select('id').single();
  await me.db.from('zarn_ai_conversations').update({updated_at:new Date().toISOString()}).eq('id',conversation);
  return Response.json({conversation_id:conversation,user_message_id:userRow?.id,message_id:saved?.id,reply:out.reply,proposal:out.proposal});
 }catch(e){console.error('ZARN assistant failed:',e);return fail(e instanceof Error&&e.name==='TimeoutError'?'That was a lot to read and took too long. Try sending it in smaller parts.':'The assistant couldn’t answer just now. Try again in a moment.',502);}
}
