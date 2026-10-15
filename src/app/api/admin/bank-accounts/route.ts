import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {currencies} from '@/lib/crm';
import {bankColumns} from '@/lib/bank';

const fields=z.object({
 currency:z.union([z.enum(currencies),z.literal('')]),
 bank:z.string().trim().min(1,'Enter the bank name.').max(120),
 account_name:z.string().trim().max(160),
 account_number:z.string().trim().min(1,'Enter the account number.').max(60),
 extra:z.string().trim().max(500),
 is_default:z.boolean(),
});
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('save'),id:z.uuid().optional(),values:fields}),
 z.object({action:z.literal('delete'),id:z.uuid()}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});

// Anyone who can manage invoices can add or edit the company's bank accounts.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const user=await staff();if(!user||!allowed('invoices',user.role)||user.role==='sales')return fail('Access denied',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=await sessionClient();
 if(b.action==='delete'){
  const {error}=await db.from('bank_accounts').delete().eq('id',b.id);
  if(error)return fail('Could not delete this account.');
  revalidatePath('/','layout');return Response.json({ok:true});
 }
 const {data:existing}=await db.from('bank_accounts').select('id');
 // The first account is the default; choosing a new default clears the old one.
 const isDefault=b.values.is_default||!(existing??[]).some(a=>a.id!==b.id);
 if(isDefault)await db.from('bank_accounts').update({is_default:false}).neq('id',b.id??'00000000-0000-0000-0000-000000000000');
 const row={...b.values,is_default:isDefault};
 const res=b.id?await db.from('bank_accounts').update(row).eq('id',b.id).select(bankColumns).single():await db.from('bank_accounts').insert(row).select(bankColumns).single();
 if(res.error||!res.data)return fail('Could not save the bank account.');
 revalidatePath('/','layout');return Response.json({ok:true,account:res.data});
}
