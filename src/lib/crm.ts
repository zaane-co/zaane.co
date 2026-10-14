// Leads CRM: pipeline stages, record shapes and formatting shared by the admin pages and /api/admin/crm.
// Pipeline stages live in public.pipeline_stages (managed from the board). kind drives the stats:
// open stages are the active pipeline, won/lost close a deal. New, Won and Lost are system stages.
export type StageKind='open'|'won'|'lost';
export type PipelineStage={key:string;label:string;color:string;position:number;kind:StageKind;system:boolean};
export type Stage=string;
export const stageColors=['#f10c45','#f97316','#f59e0b','#16a34a','#0d9488','#0891b2','#2563eb','#4f46e5','#7c3aed','#c026d3','#db2777','#52525b'];
// Open stages in order, then won, then lost.
export function orderStages(list:PipelineStage[]){const rank={open:0,won:1,lost:2};return [...list].sort((a,b)=>rank[a.kind]-rank[b.kind]||a.position-b.position);}
export function stageMap(list:PipelineStage[]){return Object.fromEntries(list.map(s=>[s.key,s])) as Record<string,PipelineStage|undefined>;}
export const sources=['website','partnership','referral','outbound','social','event','other'] as const;
export const currencies=['NGN','USD','GBP','EUR'] as const;
export const activityKinds=['note','call','meeting'] as const;
export const callOutcomes=['Connected','No answer','Left voicemail','Wrong number'];

export type Lead={id:string;name:string;email:string;company:string;phone:string;website:string;service_interested:string;budget_range:string;message:string;status:Stage;source:string;deal_value:number|null;currency:string;owner_id:string|null;tags:string[];categories:string[];project_description:string;lost_reason:string;position:number;stage_changed_at:string;last_activity_at:string;created_at:string;updated_at:string};
export type Activity={id:string;lead_id:string;kind:'note'|'call'|'meeting'|'email'|'stage'|'task';body:string;meta:Record<string,string>;author_id:string|null;created_at:string};
export type Task={id:string;lead_id:string;title:string;due_at:string|null;done_at:string|null;assignee_id:string|null;created_at:string};
export type Staff={id:string;name:string;email:string};

export function money(v:number|null|undefined,currency='NGN'){
 if(v==null)return '';
 try{return new Intl.NumberFormat('en-NG',{style:'currency',currency,maximumFractionDigits:0}).format(v);}catch{return `${currency} ${v.toLocaleString()}`;}
}
// Sums per currency so mixed-currency pipelines don't get added together.
export function totals(leads:Pick<Lead,'deal_value'|'currency'>[]){
 const m:Record<string,number>={};for(const l of leads)if(l.deal_value)m[l.currency]=(m[l.currency]??0)+Number(l.deal_value);
 return Object.entries(m).map(([c,v])=>money(v,c)).join(' · ')||'-';
}
export function ago(d:string){
 const s=(Date.now()-new Date(d).getTime())/1000;
 if(s<60)return 'just now';if(s<3600)return `${Math.floor(s/60)}m ago`;if(s<86400)return `${Math.floor(s/3600)}h ago`;if(s<86400*7)return `${Math.floor(s/86400)}d ago`;
 return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
// Due-date state for follow-up tasks: overdue, today, or upcoming.
export function dueState(d:string|null){
 if(!d)return 'none';const due=new Date(d),now=new Date();
 if(due<now&&due.toDateString()!==now.toDateString())return 'overdue';
 return due.toDateString()===now.toDateString()?'today':'upcoming';
}
export function dueLabel(d:string|null){
 if(!d)return 'No due date';const due=new Date(d),st=dueState(d);
 const time=due.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
 if(st==='today')return `Today, ${time}`;
 return due.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+(due.getHours()||due.getMinutes()?`, ${time}`:'');
}
export const initials=(s:string)=>s.split(/[\s@.]+/).filter(Boolean).slice(0,2).map(w=>w[0]!.toUpperCase()).join('')||'?';
export async function crmApi<T=Record<string,unknown>>(body:object):Promise<T>{
 const r=await fetch('/api/admin/crm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Something went wrong.');return data;
}

// Client materials checklist (things the client sends us).
export type Material={id:string;lead_id:string;title:string;note:string;link:string;file_key:string|null;file_name:string;received_at:string|null;position:number;created_at:string};
export const materialPresets=['Logo files (SVG/PNG)','Brand guidelines','Website copy / content','Photos & imagery','Domain & hosting logins','Social media access','Product list / catalogue','Reference sites they like'];

// Invoices
export type InvoiceItem={description:string;qty:number;unit_price:number};
export type InvoiceStatus='draft'|'sent'|'paid'|'void';
export type Invoice={id:string;lead_id:string;number:string;status:InvoiceStatus;currency:string;issue_date:string;due_date:string;items:InvoiceItem[];tax_rate:number;discount:number;subtotal:number;total:number;amount_paid:number;notes:string;public_token:string;sent_at:string|null;paid_at:string|null;created_at:string;updated_at:string};
export type Payment={id:string;invoice_id:string;amount:number;paid_on:string;method:string;note:string;created_at:string};
export const paymentMethods=['Bank transfer','Card','Cash','Paystack','Other'];
const r2=(n:number)=>Math.round(n*100)/100;
// One place for invoice maths so the editor preview and the saved totals always agree.
export function invoiceTotals(items:InvoiceItem[],taxRate:number,discount:number){
 const subtotal=r2(items.reduce((t,i)=>t+(Number(i.qty)||0)*(Number(i.unit_price)||0),0));
 const taxable=Math.max(0,subtotal-(Number(discount)||0)),tax=r2(taxable*(Number(taxRate)||0)/100);
 return {subtotal,tax,total:r2(taxable+tax)};
}
// Overdue is derived, not stored: a sent invoice past its due date with money still owed.
export function invoiceState(i:Pick<Invoice,'status'|'due_date'|'total'|'amount_paid'>):InvoiceStatus|'overdue'|'partial'{
 if(i.status==='sent'&&i.due_date<new Date().toISOString().slice(0,10))return 'overdue';
 if(i.status==='sent'&&i.amount_paid>0)return 'partial';
 return i.status;
}
export const invoiceStateStyle:Record<string,{label:string;color:string}>={draft:{label:'Draft',color:'#52525b'},sent:{label:'Sent',color:'#2563eb'},partial:{label:'Part paid',color:'#7c3aed'},overdue:{label:'Overdue',color:'#f10c45'},paid:{label:'Paid',color:'#16a34a'},void:{label:'Void',color:'#3f3f46'}};
export const fmtDate=(d:string)=>new Date(d.length===10?d+'T00:00:00':d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
export async function invoiceApi<T=Record<string,unknown>>(body:object):Promise<T>{
 const r=await fetch('/api/admin/invoices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Something went wrong.');return data;
}
