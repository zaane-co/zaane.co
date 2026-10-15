import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {staff,sessionClient} from '@/lib/supabase/server';
import {safeUrl} from '@/lib/cms';
import {settingKeys} from '@/lib/site-settings';

const body=z.object({values:z.record(z.string(),z.string().max(5000))});
// Saves the whole Settings page at once: filled keys are upserted, emptied keys are removed.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const user=await staff();if(user?.role!=='super_admin')return Response.json({error:'Only a super admin can change settings.'},{status:403});
 const parsed=body.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Invalid request'},{status:400});
 const upsert:{key:string;value:string}[]=[],remove:string[]=[];
 for(const f of settingKeys){
  if(!(f.key in parsed.data.values))continue;
  const v=parsed.data.values[f.key].trim();
  if(!v){remove.push(f.key);continue;}
  if((f.type==='url'||f.type==='image')&&!safeUrl(v))return Response.json({error:`${f.label}: enter a full link starting with https://`,field:f.key},{status:400});
  if(f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return Response.json({error:`${f.label}: enter a valid email address.`,field:f.key},{status:400});
  upsert.push({key:f.key,value:v});
 }
 const db=await sessionClient();
 if(upsert.length){const {error}=await db.from('settings').upsert(upsert,{onConflict:'key'});if(error)return Response.json({error:'Could not save settings.'},{status:400});}
 if(remove.length){const {error}=await db.from('settings').delete().in('key',remove);if(error)return Response.json({error:'Could not save settings.'},{status:400});}
 revalidatePath('/','layout');return Response.json({ok:true});
}
