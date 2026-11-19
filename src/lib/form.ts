// Forms are stored as docs with kind='form'; content holds this JSON. Responses live in zarn_form_responses.
export type QType='short'|'para'|'radio'|'check'|'drop'|'scale'|'date'|'time'|'section';
export type Q={id:string;t:QType;title:string;help?:string;req?:1;opts?:string[];other?:1;min?:number;max?:number;lo?:string;hi?:string};
export type FormSet={open:boolean;who:'team'|'anyone';email?:1;once?:1;done?:string;color?:string;sheet?:string;notify?:1;shuffle?:1};
export type Form={desc:string;qs:Q[];set:FormSet};
export type Answers=Record<string,string|string[]>;
export type Resp={id:string;user_id:string|null;email:string|null;answers:Answers;created_at:string};

export const QTYPES:{t:QType;label:string}[]=[
 {t:'short',label:'Short answer'},{t:'para',label:'Paragraph'},{t:'radio',label:'Multiple choice'},{t:'check',label:'Checkboxes'},
 {t:'drop',label:'Dropdown'},{t:'scale',label:'Linear scale'},{t:'date',label:'Date'},{t:'time',label:'Time'},{t:'section',label:'Title and description'},
];
export const FORM_COLORS=['#673ab7','#3f51b5','#1e88e5','#0097a7','#43a047','#f4511e','#e53935','#d81b60','#6d4c41','#455a64'];
export const OTHER='__other:';
export const newQid=()=>Math.random().toString(36).slice(2,10);
export const hasOpts=(t:QType)=>t==='radio'||t==='check'||t==='drop';
export const blankQ=(t:QType='radio'):Q=>({id:newQid(),t,title:'',...(hasOpts(t)?{opts:['Option 1']}:{}),...(t==='scale'?{min:1,max:5}:{})});
export const blankForm=():Form=>({desc:'',qs:[{...blankQ('radio'),title:'Untitled question'}],set:{open:true,who:'team',color:FORM_COLORS[0]}});

export function readForm(raw:string|null|undefined):Form{
 try{const x=JSON.parse(raw||'') as Partial<Form>;if(x&&Array.isArray(x.qs))return {desc:typeof x.desc==='string'?x.desc:'',qs:x.qs.filter(q=>q&&typeof q.id==='string'),set:{open:true,who:'team',color:FORM_COLORS[0],...(x.set??{})}};}catch{}
 return blankForm();
}

// What a person typed for a question, as one line of text (for the summary, CSV and Sheets).
export function answerText(q:Q,v:string|string[]|undefined):string{
 if(v===undefined||v==='')return '';
 const one=(s:string)=>s.startsWith(OTHER)?`Other: ${s.slice(OTHER.length)}`:s;
 return Array.isArray(v)?v.map(one).join(', '):one(v);
}

// Check a submission against the form. Returns cleaned answers, or the first problem found.
export function checkAnswers(f:Form,a:unknown):{ok:true;clean:Answers}|{ok:false;error:string}{
 if(!a||typeof a!=='object'||Array.isArray(a))return {ok:false,error:'Invalid answers.'};
 const src=a as Record<string,unknown>,clean:Answers={};
 for(const q of f.qs){
  if(q.t==='section')continue;
  const v=src[q.id],name=q.title||'A question';
  const empty=v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length);
  if(empty){if(q.req)return {ok:false,error:`“${name}” needs an answer.`};continue;}
  const okOpt=(s:unknown)=>typeof s==='string'&&((q.opts??[]).includes(s)||(!!q.other&&s.startsWith(OTHER)&&s.length>OTHER.length&&s.length<=OTHER.length+500));
  if(q.t==='check'){if(!Array.isArray(v)||v.length>50||!v.every(okOpt))return {ok:false,error:`Pick from the options for “${name}”.`};clean[q.id]=[...new Set(v as string[])];continue;}
  if(typeof v!=='string')return {ok:false,error:`“${name}” isn’t valid.`};
  if(q.t==='radio'||q.t==='drop'){if(!okOpt(v))return {ok:false,error:`Pick from the options for “${name}”.`};}
  else if(q.t==='scale'){const n=Number(v),lo=q.min??1,hi=q.max??5;if(!Number.isInteger(n)||n<lo||n>hi)return {ok:false,error:`Pick a number for “${name}”.`};}
  else if(q.t==='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return {ok:false,error:`Enter a date for “${name}”.`};}
  else if(q.t==='time'){if(!/^\d{2}:\d{2}$/.test(v))return {ok:false,error:`Enter a time for “${name}”.`};}
  else if(v.length>(q.t==='para'?10000:1000))return {ok:false,error:`The answer to “${name}” is too long.`};
  clean[q.id]=v.trim();
 }
 return {ok:true,clean};
}

// Responses as rows: a header row, then one row per response (oldest first), like Google's linked sheet.
export function responseRows(f:Form,list:Resp[],who:(r:Resp)=>string):string[][]{
 const qs=f.qs.filter(q=>q.t!=='section');
 const showWho=f.set.email||list.some(r=>r.user_id||r.email);
 const head=['Timestamp',...(showWho?['Respondent']:[]),...qs.map(q=>q.title||'Untitled question')];
 const rows=[...list].sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(r=>[new Date(r.created_at).toLocaleString('en-GB'),...(showWho?[who(r)]:[]),...qs.map(q=>answerText(q,r.answers[q.id]))]);
 return [head,...rows];
}
