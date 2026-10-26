// Schedules for client reminders and deliverables. Dates are plain YYYY-MM-DD strings in Lagos time.
export type Repeat='none'|'daily'|'weekly'|'monthly'|'yearly'|'every_n'|'adhoc';
export const reminderRepeats:Repeat[]=['none','daily','weekly','monthly','yearly','every_n'];
export const deliverableRepeats:Repeat[]=['monthly','weekly','every_n','none','adhoc'];
export const repeatLabel=(r:Repeat,n=1,deliverable=false)=>({none:deliverable?'One date':'Once',daily:'Every day',weekly:'Every week',monthly:'Every month',yearly:'Every year',every_n:`Every ${n} day${n===1?'':'s'}`,adhoc:'Ad hoc (no set date)'}[r]);
export const repeatOption=(r:Repeat,deliverable=false)=>r==='every_n'?'Every few days (custom)':repeatLabel(r,1,deliverable);

export const lagosToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(new Date());
const iso=(t:Date)=>t.toISOString().slice(0,10);
const addDays=(d:string,n:number)=>{const t=new Date(`${d}T00:00:00Z`);t.setUTCDate(t.getUTCDate()+n);return iso(t);};
// Monthly and yearly keep the start day, clamped to short months (the 31st becomes the 30th or the 28th).
const addMonths=(d:string,n:number,day:number)=>{
 const [y,m]=d.split('-').map(Number) as [number,number];const total=y*12+m-1+n,yy=Math.floor(total/12),mm=total%12;
 const last=new Date(Date.UTC(yy,mm+1,0)).getUTCDate();return iso(new Date(Date.UTC(yy,mm,Math.min(day,last))));
};
export function step(d:string,r:Repeat,n:number,start:string){
 const day=Number(start.slice(8,10));
 switch(r){case 'daily':return addDays(d,1);case 'weekly':return addDays(d,7);case 'every_n':return addDays(d,Math.max(1,n));case 'monthly':return addMonths(d,1,day);case 'yearly':return addMonths(d,12,day);default:return null;}
}
// The first due date on or after `from` (or strictly after it), following the schedule from its start date.
export function nextFrom(start:string,r:Repeat,n:number,from:string,strict=false){
 let d:string|null=start;
 for(let i=0;d&&(strict?d<=from:d<from)&&i<5000;i++)d=step(d,r,n,start);
 return d;
}
export const fmtDay=(d:string)=>new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
export function dueText(d:string|null,today=lagosToday()){
 if(!d)return 'No date';
 const diff=Math.round((Date.parse(`${d}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000);
 if(diff===0)return 'Today';if(diff===1)return 'Tomorrow';if(diff===-1)return 'Yesterday';
 if(diff<0)return `${-diff} days late`;if(diff<7)return `In ${diff} days`;return fmtDay(d);
}
export const dueTone=(d:string|null,today=lagosToday())=>!d?'none':d<today?'late':d===today?'today':'later';
