import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {clientAccess,isStudioAdmin} from '@/lib/zarn-clients';
import {deleteFile} from '@/lib/r2';
import {fireDue} from '@/lib/zarn-care-server';
import {deliverableRepeats,lagosToday,nextFrom,reminderRepeats,type Repeat} from '@/lib/zarn-care';
// A client's reminders, deliverables and receipts. Only that client's team and admins can use them; receipts are admin-only.
// Files (receipts, delivery proof) are uploaded through /api/zarn/care/file.
const id=z.uuid();
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Pick a date.');
const text={title:z.string().trim().min(1,'Give it a name.').max(160),note:z.string().trim().max(2000).default('')};
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('list'),lead_id:id}),
 z.object({action:z.literal('reminder_save'),lead_id:id,id:id.optional(),...text,repeat:z.enum(reminderRepeats as [Repeat,...Repeat[]]),every_n:z.number().int().min(1).max(365).default(1),start_on:day,audience:z.enum(['team','me']).default('team'),email:z.boolean().default(true)}),
 z.object({action:z.literal('reminder_delete'),id}),
 z.object({action:z.literal('deliverable_save'),lead_id:id,id:id.optional(),...text,repeat:z.enum(deliverableRepeats as [Repeat,...Repeat[]]),every_n:z.number().int().min(1).max(365).default(1),start_on:day.nullable().default(null)}),
 z.object({action:z.literal('deliverable_delete'),id}),
 z.object({action:z.literal('delivery_delete'),id}),
 z.object({action:z.literal('receipt_delete'),id}),
 z.object({action:z.literal('due')}),
 z.object({action:z.literal('dismiss'),ids:z.array(id).min(1).max(100)}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in first.',401);
 if(me.account_type==='guest')return fail('Guests can’t use client reminders.',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=serviceClient(),admin=isStudioAdmin(me),today=lagosToday();
 const access=async(lead:string)=>(await clientAccess(me,lead)).allowed;
 // Rows are always checked against the client they belong to, not just the id.
 const owned=async(table:string,rowId:string)=>{const {data}=await db.from(table).select('*').eq('id',rowId).maybeSingle();return data&&await access(data.lead_id)?data:null;};

 switch(b.action){
  case 'list':{
   if(!await access(b.lead_id))return fail('You don’t have access to this client.',403);
   const [{data:reminders},{data:deliverables},{data:log},receipts,invoices]=await Promise.all([
    db.from('zarn_client_reminders').select('*').eq('lead_id',b.lead_id).order('next_on',{nullsFirst:false}),
    db.from('zarn_client_deliverables').select('*').eq('lead_id',b.lead_id).order('next_on',{nullsFirst:false}),
    db.from('zarn_deliverable_log').select('id,deliverable_id,due_on,delivered_on,note,file_name,file_size,delivered_by,created_at').eq('lead_id',b.lead_id).order('delivered_on',{ascending:false}).limit(200),
    admin?db.from('zarn_client_receipts').select('id,direction,title,amount,currency,paid_on,invoice_id,note,file_name,file_size,file_type,created_by,created_at').eq('lead_id',b.lead_id).order('paid_on',{ascending:false}):Promise.resolve({data:null}),
    admin?db.from('invoices').select('id,number').eq('lead_id',b.lead_id).order('created_at',{ascending:false}):Promise.resolve({data:null}),
   ]);
   // "Only me" reminders belong to whoever set them.
   return Response.json({today,admin,me:me.user_id,reminders:(reminders??[]).filter(r=>r.audience==='team'||r.created_by===me.user_id),deliverables:deliverables??[],log:log??[],receipts:receipts.data,invoices:invoices.data});
  }
  case 'reminder_save':{
   if(!await access(b.lead_id))return fail('You don’t have access to this client.',403);
   const next_on=b.repeat==='none'?b.start_on:nextFrom(b.start_on,b.repeat,b.every_n,today);
   const row={title:b.title,note:b.note,repeat:b.repeat,every_n:b.every_n,start_on:b.start_on,next_on,audience:b.audience,email:b.email,updated_at:new Date().toISOString()};
   if(b.id){
    const cur=await owned('zarn_client_reminders',b.id);if(!cur||cur.lead_id!==b.lead_id)return fail('That reminder isn’t available.',404);
    if(cur.audience==='me'&&cur.created_by!==me.user_id)return fail('That reminder isn’t available.',404);
    const {error}=await db.from('zarn_client_reminders').update(row).eq('id',b.id);
    // A new date means it can fire again on that date.
    if(!error&&cur.next_on!==next_on)await db.from('zarn_care_alerts').delete().eq('source_id',b.id).gte('due_on',today);
    return error?fail('Could not save the reminder.'):Response.json({ok:true});
   }
   const {error}=await db.from('zarn_client_reminders').insert({...row,lead_id:b.lead_id,created_by:me.user_id});
   return error?fail('Could not save the reminder.'):Response.json({ok:true});
  }
  case 'reminder_delete':{
   const cur=await owned('zarn_client_reminders',b.id);if(!cur||(cur.audience==='me'&&cur.created_by!==me.user_id))return fail('That reminder isn’t available.',404);
   await db.from('zarn_care_alerts').delete().eq('source_id',b.id);
   await db.from('zarn_client_reminders').delete().eq('id',b.id);
   return Response.json({ok:true});
  }
  case 'deliverable_save':{
   if(!await access(b.lead_id))return fail('You don’t have access to this client.',403);
   if(b.repeat!=='adhoc'&&!b.start_on)return fail('Pick the first due date.');
   const start_on=b.repeat==='adhoc'?null:b.start_on;
   const row={title:b.title,note:b.note,repeat:b.repeat,every_n:b.every_n,start_on,updated_at:new Date().toISOString()};
   if(b.id){
    const cur=await owned('zarn_client_deliverables',b.id);if(!cur||cur.lead_id!==b.lead_id)return fail('That deliverable isn’t available.',404);
    // Changing the schedule re-plans the next due date from the new start.
    const changed=cur.repeat!==b.repeat||cur.every_n!==b.every_n||cur.start_on!==start_on;
    const next_on=!changed?cur.next_on:start_on?(b.repeat==='none'?start_on:nextFrom(start_on,b.repeat,b.every_n,today)):null;
    const {error}=await db.from('zarn_client_deliverables').update({...row,next_on}).eq('id',b.id);
    return error?fail('Could not save the deliverable.'):Response.json({ok:true});
   }
   const next_on=start_on?(b.repeat==='none'?start_on:nextFrom(start_on,b.repeat,b.every_n,today)):null;
   const {error}=await db.from('zarn_client_deliverables').insert({...row,next_on,lead_id:b.lead_id,created_by:me.user_id});
   return error?fail('Could not save the deliverable.'):Response.json({ok:true});
  }
  case 'deliverable_delete':{
   const cur=await owned('zarn_client_deliverables',b.id);if(!cur)return fail('That deliverable isn’t available.',404);
   const {data:files}=await db.from('zarn_deliverable_log').select('file_key').eq('deliverable_id',b.id).neq('file_key','');
   for(const f of files??[])await deleteFile(f.file_key).catch(()=>{});
   await db.from('zarn_care_alerts').delete().eq('source_id',b.id);
   await db.from('zarn_client_deliverables').delete().eq('id',b.id);
   return Response.json({ok:true});
  }
  case 'delivery_delete':{
   const cur=await owned('zarn_deliverable_log',b.id);if(!cur)return fail('That delivery isn’t available.',404);
   if(cur.delivered_by!==me.user_id&&!admin)return fail('Only the person who logged it or an admin can remove it.',403);
   if(cur.file_key)await deleteFile(cur.file_key).catch(()=>{});
   await db.from('zarn_deliverable_log').delete().eq('id',b.id);
   return Response.json({ok:true});
  }
  case 'receipt_delete':{
   if(!admin)return fail('Only admins can manage receipts.',403);
   const cur=await owned('zarn_client_receipts',b.id);if(!cur)return fail('That receipt isn’t available.',404);
   if(cur.file_key)await deleteFile(cur.file_key).catch(()=>{});
   await db.from('zarn_client_receipts').delete().eq('id',b.id);
   return Response.json({ok:true});
  }
  case 'due':{
   // Fires anything that came due (in case the daily job hasn't run yet), then returns your alerts you haven't dismissed.
   await fireDue().catch(()=>0);
   const since=new Date(Date.now()-14*86400000).toISOString();
   const {data:alerts}=await db.from('zarn_care_alerts').select('id,lead_id,kind,source_id,due_on,title,created_at').contains('recipients',[me.user_id]).gte('created_at',since).order('due_on').limit(50);
   if(!alerts?.length)return Response.json({alerts:[]});
   const {data:seen}=await db.from('zarn_care_alert_seen').select('alert_id').eq('user_id',me.user_id).in('alert_id',alerts.map(a=>a.id));
   const done=new Set((seen??[]).map(s=>s.alert_id));
   // A deliverable alert goes away once it's been delivered (its next date moved past the alert's date).
   const delIds=alerts.filter(a=>a.kind==='deliverable').map(a=>a.source_id);
   const {data:dels}=delIds.length?await db.from('zarn_client_deliverables').select('id,next_on').in('id',delIds):{data:[]};
   const nextOf=new Map((dels??[]).map(d=>[d.id,d.next_on as string|null]));
   const live=alerts.filter(a=>!done.has(a.id)&&(a.kind==='reminder'||(nextOf.has(a.source_id)&&nextOf.get(a.source_id)===a.due_on)));
   const {data:leads}=live.length?await db.from('leads').select('id,name,company').in('id',[...new Set(live.map(a=>a.lead_id))]):{data:[]};
   const names=Object.fromEntries((leads??[]).map(l=>[l.id,l.company||l.name]));
   return Response.json({alerts:live.map(a=>({...a,client:names[a.lead_id]??'Client'}))});
  }
  case 'dismiss':{
   await db.from('zarn_care_alert_seen').upsert(b.ids.map(alert_id=>({alert_id,user_id:me.user_id})),{onConflict:'alert_id,user_id',ignoreDuplicates:true});
   return Response.json({ok:true});
  }
 }
}
