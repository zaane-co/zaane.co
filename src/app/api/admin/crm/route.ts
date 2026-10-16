import {z} from 'zod';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {sources,currencies,activityKinds} from '@/lib/crm';
import {deleteFile,r2Configured} from '@/lib/r2';
const id=z.uuid();
// Stage keys are checked against pipeline_stages by the leads foreign key.
const stage=z.string().regex(/^[a-z0-9_]{1,40}$/,'Invalid stage');
const color=z.string().regex(/^#[0-9a-f]{6}$/,'Pick a colour');
const label=z.string().trim().min(1,'Name the stage.').max(40,'Keep stage names under 40 characters.');
const text=(max:number)=>z.string().trim().max(max);
const lead=z.object({
 name:text(120).min(1,'Name is required.'),email:z.email('Enter a valid email.').max(254),company:text(200),phone:text(40),
 website:text(300).refine(v=>!v||/^https?:\/\/\S+$/.test(v),'Website must start with http:// or https://'),
 service_interested:text(120),budget_range:text(100),message:text(10000),status:stage,source:z.enum(sources),
 deal_value:z.number().nonnegative().max(1e12).nullable(),currency:z.enum(currencies),owner_id:id.nullable(),
 tags:z.array(text(30).min(1)).max(12),lost_reason:text(300),
 project_description:text(50000),categories:z.array(text(60).min(1)).max(12),
 project_completed_at:z.iso.datetime({offset:true}).nullable(),
});
const due=z.iso.datetime({offset:true}).nullable();
const actions=z.discriminatedUnion('action',[
 // Only name and email are required to create a lead; every other field is optional (including ones added later).
 z.object({action:z.literal('create_lead'),values:lead.partial().required({name:true,email:true})}),
 z.object({action:z.literal('update_lead'),id,values:lead.partial()}),
 z.object({action:z.literal('move'),id,status:stage,position:z.number().finite()}),
 z.object({action:z.literal('delete_lead'),id}),
 z.object({action:z.literal('add_activity'),lead_id:id,kind:z.enum(activityKinds),body:text(20000).min(1,'Write something first.'),outcome:text(40).optional()}),
 z.object({action:z.literal('delete_activity'),id}),
 z.object({action:z.literal('add_task'),lead_id:id,title:text(300).min(1,'Give the task a title.'),due_at:due,assignee_id:id.nullable()}),
 z.object({action:z.literal('toggle_task'),id,done:z.boolean()}),
 z.object({action:z.literal('delete_task'),id}),
 z.object({action:z.literal('send_email'),lead_id:id,subject:text(200).min(1,'Add a subject.'),body:text(20000).min(1,'Write the email first.')}),
 z.object({action:z.literal('convert_contact'),id}),
 z.object({action:z.literal('stage_create'),label,color}),
 z.object({action:z.literal('category_create'),name:text(60).min(1,'Name the category.')}),
 z.object({action:z.literal('material_add'),lead_id:id,titles:z.array(text(200).min(1)).min(1).max(20),note:text(2000).optional(),link:text(2000).optional()}),
 z.object({action:z.literal('material_update'),id,title:text(200).min(1).optional(),note:text(2000).optional(),link:text(2000).optional(),received:z.boolean().optional()}),
 z.object({action:z.literal('material_delete'),id}),
 z.object({action:z.literal('stage_update'),key:stage,label:label.optional(),color:color.optional()}),
 z.object({action:z.literal('stage_reorder'),keys:z.array(stage).min(1).max(50)}),
 z.object({action:z.literal('stage_delete'),key:stage,move_to:stage}),
]);
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fail=(error:string,status=400)=>Response.json({error},{status});

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const user=await staff();if(!user||!allowed('leads',user.role))return fail('Access denied',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=await sessionClient();
 switch(b.action){
  case 'create_lead':{
   const {data,error}=await db.from('leads').insert({source:'outbound',service_interested:'',message:'',...b.values,email:b.values.email.toLowerCase(),owner_id:b.values.owner_id??user.id}).select('id').single();
   if(error)return fail('Could not create this lead.');
   return Response.json({ok:true,id:data.id});
  }
  case 'update_lead':{
   const v={...b.values};if(v.email)v.email=v.email.toLowerCase();
   
   const {data,error}=await db.from('leads').update(v).eq('id',b.id).select('id');
   if(error||!data?.length)return fail('Could not save this lead.');
   return Response.json({ok:true});
  }
  case 'move':{
   const {data,error}=await db.from('leads').update({status:b.status,position:b.position}).eq('id',b.id).select('id');
   if(error||!data?.length)return fail('Could not move this lead.');
   return Response.json({ok:true});
  }
  case 'delete_lead':{
   const {error}=await db.from('leads').delete().eq('id',b.id);
   if(error?.code==='23503')return fail('This client has invoices. Delete or void them before deleting the lead.');
   return error?fail('Could not delete this lead.'):Response.json({ok:true});
  }
  case 'add_activity':{
   const {data,error}=await db.from('lead_activities').insert({lead_id:b.lead_id,kind:b.kind,body:b.body,meta:b.kind==='call'&&b.outcome?{outcome:b.outcome}:{},author_id:user.id}).select('*').single();
   return error?fail('Could not log this.'):Response.json({ok:true,activity:data});
  }
  case 'delete_activity':{
   // Stage and email rows are the audit trail, so only notes, calls and meetings can be removed.
   const {data,error}=await db.from('lead_activities').delete().eq('id',b.id).in('kind',activityKinds).select('id');
   return error||!data?.length?fail('This entry can’t be deleted.'):Response.json({ok:true});
  }
  case 'add_task':{
   const {data,error}=await db.from('lead_tasks').insert({lead_id:b.lead_id,title:b.title,due_at:b.due_at,assignee_id:b.assignee_id??user.id,created_by:user.id}).select('*').single();
   return error?fail('Could not add this task.'):Response.json({ok:true,task:data});
  }
  case 'toggle_task':{
   const {data,error}=await db.from('lead_tasks').update({done_at:b.done?new Date().toISOString():null}).eq('id',b.id).select('*').single();
   if(error)return fail('Could not update this task.');
   if(b.done)await db.from('lead_activities').insert({lead_id:data.lead_id,kind:'task',body:data.title,author_id:user.id});
   return Response.json({ok:true,task:data});
  }
  case 'delete_task':{
   const {error}=await db.from('lead_tasks').delete().eq('id',b.id);
   return error?fail('Could not delete this task.'):Response.json({ok:true});
  }
  case 'send_email':{
   const {data:l}=await db.from('leads').select('id,name,email').eq('id',b.lead_id).single();
   if(!l)return fail('Lead not found.',404);
   if(!l.email)return fail('This lead has no email address. Add one in Details first.');
   const key=process.env.RESEND_API_KEY,inbox=process.env.CRM_FROM_EMAIL||process.env.LEAD_NOTIFICATION_EMAIL;
   if(!key||!inbox)return fail('Email isn’t configured. Set RESEND_API_KEY and LEAD_NOTIFICATION_EMAIL.',503);
   // Sent from the studio inbox with a BCC to it, so replies and the sent copy both live in the real mailbox.
   const html=`<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#111">${esc(b.body).replace(/\n/g,'<br>')}</div>`;
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:`${user.name||'Zaane'} at Zaane <${inbox}>`,to:[l.email],bcc:[inbox],reply_to:inbox,subject:b.subject,text:b.body,html})});
   const sent=await r.json().catch(()=>({}));
   if(!r.ok)return fail(sent.message?`Email failed: ${sent.message}`:'Email failed to send.',502);
   const {data:activity}=await db.from('lead_activities').insert({lead_id:l.id,kind:'email',body:b.body,meta:{subject:b.subject,to:l.email,resend_id:String(sent.id??'')},author_id:user.id}).select('*').single();
   // First outreach moves a brand-new lead to Contacted.
   const {data:contacted}=await db.from('pipeline_stages').select('key').eq('key','contacted').maybeSingle();
   if(contacted)await db.from('leads').update({status:'contacted'}).eq('id',l.id).eq('status','new');
   return Response.json({ok:true,activity});
  }
  case 'convert_contact':{
   const {data:c}=await db.from('contact_submissions').select('*').eq('id',b.id).single();
   if(!c)return fail('Message not found.',404);
   const {data,error}=await db.from('leads').insert({name:c.name,email:String(c.email).toLowerCase(),phone:c.phone??'',company:c.company??'',service_interested:c.subject,message:c.message,source:'website',owner_id:user.id}).select('id').single();
   if(error)return fail('Could not convert this message.');
   await Promise.all([
    db.from('lead_activities').insert({lead_id:data.id,kind:'note',body:`Converted from a contact form message (“${c.subject}”) sent ${new Date(c.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}.`,author_id:user.id}),
    db.from('contact_submissions').update({status:'resolved'}).eq('id',c.id),
   ]);
   return Response.json({ok:true,id:data.id});
  }
  case 'category_create':{
   const name=b.name.replace(/\s+/g,' ');
   const {error}=await db.from('lead_categories').insert({name});
   return error&&error.code!=='23505'?fail('Could not add this category.'):Response.json({ok:true,name});
  }
  case 'material_add':{
   if(b.link&&!/^https?:\/\/\S+$/.test(b.link))return fail('Links must start with http:// or https://');
   const {data:last}=await db.from('lead_materials').select('position').eq('lead_id',b.lead_id).order('position',{ascending:false}).limit(1).maybeSingle();
   const start=(last?.position??-1)+1;
   const {error}=await db.from('lead_materials').insert(b.titles.map((title,i)=>({lead_id:b.lead_id,title,note:b.note??'',link:b.link??'',position:start+i})));
   return error?fail('Could not add this item.'):Response.json({ok:true});
  }
  case 'material_update':{
   if(b.link&&!/^https?:\/\/\S+$/.test(b.link))return fail('Links must start with http:// or https://');
   const patch:Record<string,unknown>={};
   if(b.title!==undefined)patch.title=b.title;if(b.note!==undefined)patch.note=b.note;if(b.link!==undefined)patch.link=b.link;
   if(b.received!==undefined)patch.received_at=b.received?new Date().toISOString():null;
   const {data,error}=await db.from('lead_materials').update(patch).eq('id',b.id).select('lead_id,title').single();
   if(error)return fail('Could not update this item.');
   if(b.received)await db.from('lead_activities').insert({lead_id:data.lead_id,kind:'task',body:`Received: ${data.title}`,author_id:user.id});
   return Response.json({ok:true});
  }
  case 'material_delete':{
   const {data,error}=await db.from('lead_materials').delete().eq('id',b.id).select('file_key').single();
   if(error)return fail('Could not delete this item.');
   if(data.file_key&&r2Configured())await deleteFile(data.file_key).catch(()=>{});
   return Response.json({ok:true});
  }
  case 'stage_create':{
   const base=b.label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,30)||'stage';
   const {data:all}=await db.from('pipeline_stages').select('key,position,kind');
   const taken=new Set((all??[]).map(r=>r.key));let key=base;for(let n=2;taken.has(key);n++)key=`${base}_${n}`;
   const position=Math.max(-1,...(all??[]).filter(r=>r.kind==='open').map(r=>r.position))+1;
   const {data,error}=await db.from('pipeline_stages').insert({key,label:b.label,color:b.color,position,kind:'open'}).select('*').single();
   return error?fail('Could not add this stage.'):Response.json({ok:true,stage:data});
  }
  case 'stage_update':{
   const patch={...(b.label?{label:b.label}:{}),...(b.color?{color:b.color}:{})};
   const {data,error}=await db.from('pipeline_stages').update(patch).eq('key',b.key).select('key');
   return error||!data?.length?fail('Could not update this stage.'):Response.json({ok:true});
  }
  case 'stage_reorder':{
   // Only open stages are reordered; Won and Lost always close the board.
   const results=await Promise.all(b.keys.map((key,position)=>db.from('pipeline_stages').update({position}).eq('key',key).eq('kind','open')));
   return results.some(r=>r.error)?fail('Could not reorder stages.'):Response.json({ok:true});
  }
  case 'stage_delete':{
   if(b.key===b.move_to)return fail('Pick a different stage to move its leads to.');
   const {data:s}=await db.from('pipeline_stages').select('system').eq('key',b.key).single();
   if(!s)return fail('Stage not found.',404);if(s.system)return fail('New, Won and Lost can be renamed but not deleted.');
   const moved=await db.from('leads').update({status:b.move_to}).eq('status',b.key);
   if(moved.error)return fail('Could not move the leads in this stage.');
   const {error}=await db.from('pipeline_stages').delete().eq('key',b.key);
   return error?fail('Could not delete this stage.'):Response.json({ok:true});
  }
 }
}
