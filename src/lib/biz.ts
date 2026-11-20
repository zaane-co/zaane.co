// ZARN Business: shared shapes and helpers for the money book, receipts and bills.
export const inCategories=['Customer payment','Retainer','Product sales','Refund','Other income'];
export const outCategories=['Salaries','Contractors','Software','Rent & utilities','Internet & phone','Marketing','Equipment','Transport','Taxes & fees','Bank charges','Other'];
export const billRepeats=['none','weekly','monthly','yearly'] as const;
export type BillRepeat=typeof billRepeats[number];
export const repeatName:Record<BillRepeat,string>={none:'One-off',weekly:'Every week',monthly:'Every month',yearly:'Every year'};

export type Entry={id:string;direction:'in'|'out';title:string;amount:number;currency:string;paid_on:string;category:string;vendor:string;note:string;contact_id:string|null;invoice_id:string|null;bill_id:string|null;file_name:string;file_size:number;file_type:string;created_at:string;contact?:string;source?:'entry'|'invoice'};
export type Bill={id:string;title:string;vendor:string;amount:number;currency:string;category:string;due_on:string|null;repeat:BillRepeat;start_on:string|null;note:string;last_paid_on:string|null;created_at:string};

const pad=(n:number)=>String(n).padStart(2,'0');
const iso=(y:number,m:number,d:number)=>{const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return `${y}-${pad(m+1)}-${pad(Math.min(d,last))}`;};
// The next due date after `from`, keeping the bill's day of month (31st falls back to the month's last day).
export function nextBillDate(due:string,repeat:BillRepeat,start:string|null){
 if(repeat==='none')return null;
 const [y,m,d]=due.split('-').map(Number),day=start?Number(start.slice(8,10)):d;
 if(repeat==='weekly'){const t=new Date(Date.UTC(y,m-1,d+7));return t.toISOString().slice(0,10);}
 if(repeat==='monthly')return iso(m===12?y+1:y,m%12,day);
 return iso(y+1,m-1,day);
}
// Sums per currency so different currencies never get added together.
export function sumBy<T extends {amount:number;currency:string}>(rows:T[]){const m:Record<string,number>={};for(const r of rows)m[r.currency]=(m[r.currency]??0)+Number(r.amount);return m;}
export const monthKey=(d:string)=>d.slice(0,7);
export const monthName=(k:string)=>new Date(`${k}-01T12:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
export function csv(rows:(string|number)[][]){return rows.map(r=>r.map(c=>{const s=String(c);return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}).join(',')).join('\n');}

// Business contacts: leads until they're won, then customers. Separate from Clients on purpose.
export const stages=[{key:'new',label:'New',color:'#2563eb'},{key:'contacted',label:'Contacted',color:'#d97706'},{key:'proposal',label:'Proposal sent',color:'#7c3aed'},{key:'won',label:'Customer',color:'#16a34a'},{key:'lost',label:'Lost',color:'#52525b'}] as const;
export type StageKey=typeof stages[number]['key'];
export const stageOf=(k:string)=>stages.find(s=>s.key===k)??stages[0];
export const contactSources=['manual','form','referral','social','website','event','other'] as const;
export const sourceName:Record<string,string>={manual:'Added by hand',form:'Lead form',referral:'Referral',social:'Social media',website:'Website',event:'Event',other:'Other'};
export type Contact={id:string;name:string;email:string;company:string;phone:string;stage:StageKey;source:string;value:number|null;currency:string;note:string;created_at:string;updated_at:string};
export const contactName=(c:Pick<Contact,'name'|'company'>|null|undefined)=>c?(c.company?`${c.company} (${c.name})`:c.name):'';
