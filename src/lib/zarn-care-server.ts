import 'server-only';
import {serviceClient} from '@/lib/supabase/server';
import {pushTo} from '@/lib/zarn-push';
import {siteUrl} from '@/lib/newsletter';
import {fmtDay,lagosToday,nextFrom,type Repeat} from '@/lib/zarn-care';

// Active staff on a client's team, the people who get that client's reminders.
export async function clientTeam(leadId:string){
 const db=serviceClient();
 const {data:ch}=await db.from('zarn_channels').select('id').eq('kind','client').eq('lead_id',leadId).maybeSingle();
 if(!ch)return [];
 const {data:cm}=await db.from('zarn_channel_members').select('user_id').eq('channel_id',ch.id);
 const ids=(cm??[]).map(r=>r.user_id);if(!ids.length)return [];
 const {data:m}=await db.from('zarn_members').select('user_id').in('user_id',ids).is('deactivated_at',null).eq('account_type','member');
 return (m??[]).map(r=>r.user_id);
}

type Fired={id:string;lead_id:string;kind:'reminder'|'deliverable';title:string;due_on:string;recipients:string[];email:boolean};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

// Turns everything due today (or missed) into alerts, then pushes and emails the people they're for.
// Safe to run any number of times a day: each item fires once per due date.
export async function fireDue(){
 const db=serviceClient(),today=lagosToday(),fired:Fired[]=[];
 const teams=new Map<string,string[]>();
 const team=async(lead:string)=>{if(!teams.has(lead))teams.set(lead,await clientTeam(lead));return teams.get(lead)!;};
 const {data:rem}=await db.from('zarn_client_reminders').select('id,lead_id,title,repeat,every_n,start_on,next_on,audience,email,created_by').lte('next_on',today).limit(500);
 for(const r of rem??[]){
  const recipients=r.audience==='me'?(r.created_by?[r.created_by]:[]):await team(r.lead_id);
  const {data:a}=await db.from('zarn_care_alerts').upsert({lead_id:r.lead_id,kind:'reminder',source_id:r.id,due_on:r.next_on,title:r.title,recipients},{onConflict:'source_id,due_on',ignoreDuplicates:true}).select('id');
  if(a?.length)fired.push({id:a[0]!.id,lead_id:r.lead_id,kind:'reminder',title:r.title,due_on:r.next_on!,recipients,email:r.email});
  // Repeating reminders move on to their next date after today; one-off reminders are finished.
  const next=r.repeat==='none'?null:nextFrom(r.start_on,r.repeat as Repeat,r.every_n,today,true);
  await db.from('zarn_client_reminders').update({next_on:next}).eq('id',r.id);
 }
 // Deliverables stay due until someone marks them delivered.
 const {data:del}=await db.from('zarn_client_deliverables').select('id,lead_id,title,next_on').lte('next_on',today).limit(500);
 for(const d of del??[]){
  const recipients=await team(d.lead_id);
  const {data:a}=await db.from('zarn_care_alerts').upsert({lead_id:d.lead_id,kind:'deliverable',source_id:d.id,due_on:d.next_on,title:d.title,recipients},{onConflict:'source_id,due_on',ignoreDuplicates:true}).select('id');
  if(a?.length)fired.push({id:a[0]!.id,lead_id:d.lead_id,kind:'deliverable',title:d.title,due_on:d.next_on!,recipients,email:true});
 }
 if(fired.length)await notify(fired);
 return fired.length;
}

async function notify(fired:Fired[]){
 const db=serviceClient(),site=siteUrl();
 const leadIds=[...new Set(fired.map(f=>f.lead_id))];
 const {data:leads}=await db.from('leads').select('id,name,company').in('id',leadIds);
 const client=Object.fromEntries((leads??[]).map(l=>[l.id,l.company||l.name||'Client']));
 const line=(f:Fired)=>`${f.kind==='deliverable'?'Deliverable due':'Reminder'} for ${client[f.lead_id]}: ${f.title}`;
 for(const f of fired)await pushTo(f.recipients,{title:client[f.lead_id]??'ZARN',body:`${f.kind==='deliverable'?'Deliverable due: ':'Reminder: '}${f.title}`,tag:`care-${f.id}`,url:`/zarn/clients/${f.lead_id}`});
 // One email per person, listing everything that came due for them.
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM;if(!key||!from)return;
 const byUser=new Map<string,Fired[]>();
 for(const f of fired)if(f.email)for(const u of f.recipients)byUser.set(u,[...(byUser.get(u)??[]),f]);
 if(!byUser.size)return;
 const {data:people}=await db.from('zarn_members').select('user_id,email,work_email,display_name').in('user_id',[...byUser.keys()]);
 for(const p of people??[]){
  const items=byUser.get(p.user_id)!,to=p.work_email||p.email;if(!to)continue;
  const subject=items.length===1?line(items[0]!):`${items.length} client reminders for today`;
  const rows=items.map(f=>`<li style="margin:0 0 12px;line-height:1.5"><b>${esc(client[f.lead_id]??'Client')}</b>: ${esc(f.title)}<br><span style="color:#666;font-size:13px">${f.kind==='deliverable'?'Deliverable':'Reminder'} · due ${esc(fmtDay(f.due_on))}</span> · <a href="${site}/zarn/clients/${f.lead_id}" style="color:#f10c45">Open client</a></li>`).join('');
  await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,
   text:items.map(f=>`${line(f)} (due ${fmtDay(f.due_on)})\n${site}/zarn/clients/${f.lead_id}`).join('\n\n'),
   html:`<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111"><p style="font-size:22px;font-weight:800;margin:0 0 4px;letter-spacing:-.02em">ZARN</p><p style="font-size:18px;font-weight:600;margin:16px 0">Hi ${esc(p.display_name||'there')}, this is due today</p><ul style="padding-left:18px;margin:0">${rows}</ul></div>`})}).catch(()=>null);
 }
}
