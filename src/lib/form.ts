// Forms are stored as docs with kind='form'; content holds this JSON. Responses live in zarn_form_responses.
export type QType='short'|'para'|'radio'|'check'|'drop'|'scale'|'date'|'time'|'file'|'section'|'page';
export type Q={id:string;t:QType;title:string;help?:string;req?:1;opts?:string[];other?:1;min?:number;max?:number;lo?:string;hi?:string;kinds?:FileKind[];maxN?:number;maxMb?:number};
export type FileKind='image'|'video'|'audio'|'doc';
export type FormSet={open:boolean;who:'team'|'anyone';email?:1;once?:1;done?:string;color?:string;sheet?:string;notify?:1;shuffle?:1;lead?:1};
export type Form={desc:string;qs:Q[];set:FormSet};
export type Answers=Record<string,string|string[]>;
export type Resp={id:string;user_id:string|null;email:string|null;answers:Answers;created_at:string};

export const QTYPES:{t:QType;label:string}[]=[
 {t:'short',label:'Short answer'},{t:'para',label:'Paragraph'},{t:'radio',label:'Multiple choice'},{t:'check',label:'Checkboxes'},
 {t:'drop',label:'Dropdown'},{t:'scale',label:'Linear scale'},{t:'date',label:'Date'},{t:'time',label:'Time'},{t:'file',label:'File upload'},{t:'section',label:'Title and description'},{t:'page',label:'Page break'},
];
export const FORM_COLORS=['#673ab7','#3f51b5','#1e88e5','#0097a7','#43a047','#f4511e','#e53935','#d81b60','#6d4c41','#455a64'];
export const OTHER='__other:';
export const newQid=()=>Math.random().toString(36).slice(2,10);
// Questions people answer (not headings or page breaks).
export const isAsk=(q:Q)=>q.t!=='section'&&q.t!=='page';
// The form split into pages at each page break. Each page after the first starts with its break (its title and description).
export function pagesOf(qs:Q[]):Q[][]{const out:Q[][]=[[]];for(const q of qs){if(q.t==='page')out.push([q]);else out[out.length-1].push(q);}return out.filter((p,i)=>i===0||p.length);}
export const hasOpts=(t:QType)=>t==='radio'||t==='check'||t==='drop';
export const blankQ=(t:QType='radio'):Q=>({id:newQid(),t,title:'',...(hasOpts(t)?{opts:['Option 1']}:{}),...(t==='scale'?{min:1,max:5}:{}),...(t==='file'?{maxN:1,maxMb:100}:{})});
export const blankForm=():Form=>({desc:'',qs:[{...blankQ('radio'),title:'Untitled question'}],set:{open:true,who:'team',color:FORM_COLORS[0]}});

export function readForm(raw:string|null|undefined):Form{
 try{const x=JSON.parse(raw||'') as Partial<Form>;if(x&&Array.isArray(x.qs))return {desc:typeof x.desc==='string'?x.desc:'',qs:x.qs.filter(q=>q&&typeof q.id==='string'),set:{open:true,who:'team',color:FORM_COLORS[0],...(x.set??{})}};}catch{}
 return blankForm();
}

// File upload questions. Files go from the browser straight to storage under the form's folder;
// the answer keeps one line per file: "key|size|name".
export const FILE_KINDS:{k:FileKind;label:string;accept:string}[]=[
 {k:'image',label:'Images',accept:'image/*'},{k:'video',label:'Videos',accept:'video/*'},{k:'audio',label:'Audio',accept:'audio/*'},
 {k:'doc',label:'Documents',accept:'.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.pages,.numbers,.key,.zip,.rar,.7z'},
];
export const FILE_COUNTS=[1,5,10];
export const FILE_SIZES=[10,100,1024,5120];
export const sizeName=(mb:number)=>mb>=1024?`${mb/1024} GB`:`${mb} MB`;
export const fileBytes=(n:number)=>n<1024?`${n} B`:n<1048576?`${Math.round(n/1024)} KB`:n<1073741824?`${(n/1048576).toFixed(1)} MB`:`${(n/1073741824).toFixed(2)} GB`;
export const formFilePrefix=(doc:string,q:string)=>`private/zarn/forms/${doc}/${q}/`;
export const acceptOf=(q:Q)=>q.kinds?.length?q.kinds.map(k=>FILE_KINDS.find(x=>x.k===k)?.accept).join(','):'';
const docExt=/\.(pdf|docx?|xlsx?|pptx?|txt|csv|rtf|odt|ods|odp|pages|numbers|key|zip|rar|7z)$/i;
const mediaExt:Record<'image'|'video'|'audio',RegExp>={image:/\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|tiff?)$/i,video:/\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i,audio:/\.(mp3|m4a|wav|aac|ogg|flac|opus)$/i};
// Never take files a browser could run.
export const blockedFile=/\.(html?|xhtml|svg|js|mjs|xml|exe|bat|cmd|sh|msi|dmg|app|php|apk|jar)$/i;
export function fileKindOk(q:Q,name:string,type:string){
 if(blockedFile.test(name))return false;
 if(!q.kinds?.length)return true;
 return q.kinds.some(k=>k==='doc'?docExt.test(name):type.startsWith(`${k}/`)||mediaExt[k].test(name));
}
export const parseFile=(s:string)=>{const a=s.indexOf('|'),b=s.indexOf('|',a+1);return a<0||b<0?null:{key:s.slice(0,a),size:Number(s.slice(a+1,b))||0,name:s.slice(b+1)};};
export const isFileAnswer=(q:Q)=>q.t==='file';

// What a person typed for a question, as one line of text (for the summary, CSV and Sheets).
export function answerText(q:Q,v:string|string[]|undefined):string{
 if(v===undefined||v==='')return '';
 if(q.t==='file')return (Array.isArray(v)?v:[v]).map(x=>parseFile(x)?.name??'').filter(Boolean).join(', ');
 const one=(s:string)=>s.startsWith(OTHER)?`Other: ${s.slice(OTHER.length)}`:s;
 return Array.isArray(v)?v.map(one).join(', '):one(v);
}

// Check a submission against the form. Returns cleaned answers, or the first problem found.
export function checkAnswers(f:Form,a:unknown,doc?:string):{ok:true;clean:Answers}|{ok:false;error:string}{
 if(!a||typeof a!=='object'||Array.isArray(a))return {ok:false,error:'Invalid answers.'};
 const src=a as Record<string,unknown>,clean:Answers={};
 for(const q of f.qs){
  if(!isAsk(q))continue;
  const v=src[q.id],name=q.title||'A question';
  const empty=v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length);
  if(empty){if(q.req)return {ok:false,error:`“${name}” needs an answer.`};continue;}
  const okOpt=(s:unknown)=>typeof s==='string'&&((q.opts??[]).includes(s)||(!!q.other&&s.startsWith(OTHER)&&s.length>OTHER.length&&s.length<=OTHER.length+500));
  if(q.t==='file'){const pre=formFilePrefix(doc??'',q.id);
   if(!doc||!Array.isArray(v)||v.length>(q.maxN??1)||!v.every(s=>{const p=typeof s==='string'?parseFile(s):null;return !!p&&p.key.startsWith(pre)&&!p.key.slice(pre.length).includes('/')&&p.name.length>0&&p.name.length<=255;}))return {ok:false,error:`The files for “${name}” aren’t valid.`};
   clean[q.id]=[...new Set(v as string[])];continue;}
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
 const qs=f.qs.filter(isAsk);
 const showWho=f.set.email||list.some(r=>r.user_id||r.email);
 const head=['Timestamp',...(showWho?['Respondent']:[]),...qs.map(q=>q.title||'Untitled question')];
 const rows=[...list].sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(r=>[new Date(r.created_at).toLocaleString('en-GB'),...(showWho?[who(r)]:[]),...qs.map(q=>answerText(q,r.answers[q.id]))]);
 return [head,...rows];
}

// A form set to capture leads: picks name, email, company, phone and message out of the answers by question title.
export function leadFrom(f:Form,a:Answers,email:string|null){
 const pick=(re:RegExp)=>{for(const q of f.qs){if(!isAsk(q)||q.t==='file'||!re.test(q.title))continue;const v=a[q.id];const t=Array.isArray(v)?v.join(', '):v;if(t)return String(t).replace(/^__other:/,'').trim();}return '';};
 const mail=(pick(/e-?mail/i)||email||'').toLowerCase();
 const used=new Set<string>();for(const q of f.qs)if(/name|e-?mail|company|business|brand|organi[sz]ation|phone|whatsapp|mobile/i.test(q.title))used.add(q.id);
 const rest=f.qs.filter(q=>isAsk(q)&&!used.has(q.id)&&a[q.id]).map(q=>`${q.title}: ${answerText(q,a[q.id])}`).join('\n');
 return {name:pick(/name/i).slice(0,120),email:mail.slice(0,254),company:pick(/company|business|brand|organi[sz]ation/i).slice(0,200),phone:pick(/phone|whatsapp|mobile/i).slice(0,40),message:rest.slice(0,5000)};
}
