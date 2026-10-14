import 'server-only';
import {notFound} from 'next/navigation';
import {staff,sessionClient,serviceClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {orderStages,type PipelineStage,type Staff} from '@/lib/crm';
export async function invoiceAccess(){
 const user=await staff();if(!user||!allowed('invoices',user.role))notFound();
 return {user,db:await sessionClient()};
}
export async function crmAccess(){
 const user=await staff();if(!user||!allowed('leads',user.role))notFound();
 return {user,db:await sessionClient()};
}
// Owner/assignee choices. Admins can only read their own users row under RLS, so the staff list comes from the service client.
export async function staffList():Promise<Staff[]>{
 const {data}=await serviceClient().from('users').select('id,name,email').not('role','is',null).order('name');
 return (data??[]) as Staff[];
}
export async function loadStages(db:Awaited<ReturnType<typeof sessionClient>>){
 const {data}=await db.from('pipeline_stages').select('key,label,color,position,kind,system');
 return orderStages((data??[]) as PipelineStage[]);
}
