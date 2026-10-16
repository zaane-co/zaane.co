import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {aiConfigured,execute,turn} from '@/lib/zarn-ai';
export const maxDuration=60;
const fail=(error:string,status=400)=>Response.json({error},{status});
const body=z.union([
 z.object({action:z.literal('chat'),messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(4000)})).min(1).max(30)}),
 z.object({action:z.literal('confirm'),tool:z.enum(['create_task','update_task']),args:z.unknown()}),
]);
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in to ZARN first.',401);
 if(me.account_type==='guest')return fail('The assistant is for team members.',403);
 const parsed=body.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail('Invalid request');
 const b=parsed.data;
 if(b.action==='confirm'){
  try{return Response.json({reply:await execute(me,b.tool,b.args)});}
  catch(e){return fail(e instanceof z.ZodError?'That action is no longer valid. Ask again.':e instanceof Error?e.message:'Could not do that.');}
 }
 if(!aiConfigured())return fail('The assistant isn’t set up yet. An admin needs to add the Cloudflare AI token.',503);
 const cap=Number(process.env.ZARN_AI_DAILY_CAP)||40;
 const {data:allowed,error:limitError}=await serviceClient().rpc('zarn_ai_consume',{uid:me.user_id,cap});
 if(limitError)return fail('The assistant isn’t available right now.',503);
 if(!allowed)return fail(`You’ve used today’s ${cap} assistant requests. It resets tomorrow.`,429);
 try{return Response.json(await turn(me,b.messages));}
 catch(e){console.error('ZARN assistant failed:',e);return fail('The assistant couldn’t answer just now. Try again in a moment.',502);}
}
