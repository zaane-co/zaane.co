'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {ArrowDown,ArrowUp,Check,ChevronLeft,ChevronRight,CircleDot,ClipboardList,CloudCheck,CloudOff,Copy,Download,Eye,FileSpreadsheet,Folder,GripVertical,Heading,Link2,SeparatorHorizontal,Loader2,Plus,RefreshCw,Send,Share2,Square,Trash2,X} from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import {useZarn} from './ZarnProvider';
import {useNav} from './nav';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';
import {Avatar} from './format';
import ShareDoc from './ShareDoc';
import FormFill from './FormFill';
import {FORM_COLORS,OTHER,QTYPES,answerText,blankQ,hasOpts,isAsk,newQid,readForm,responseRows,type Form,type Q,type QType,type Resp} from '@/lib/form';
import {ref} from '@/lib/sheet';
type Row={id:string;title:string;content:string;owner_id:string;kind:string;drive:'my'|'team'|'client';folder_id:string|null;lead_id:string|null};
type Role='owner'|'edit'|'view';
type Tab='questions'|'responses'|'settings';
const SHARE_BASE=(process.env.NEXT_PUBLIC_SHARE_URL||'https://zaane.co').replace(/\/$/,'');

// A form in Drive, built to feel like Google Forms: questions on cards you click to edit, a Responses tab
// with a summary, each response and a linked sheet, and settings for who can answer.
export default function FormPage({id}:{id:string}){
 const canLead=useNav().canBusiness;
 const {db,me,people,channels,title:chTitle}=useZarn(),router=useRouter(),confirm=useConfirm(),params=useSearchParams();
 const [row,setRow]=useState<Row|null|undefined>(undefined),[role,setRole]=useState<Role|null>(null);
 const [form,setForm]=useState<Form|null>(null),[title,setTitle]=useState(''),[state,setState]=useState<'saved'|'saving'|'error'>('saved');
 const [tab,setTab]=useState<Tab>(params.get('tab')==='responses'?'responses':'questions'),[focus,setFocus]=useState<string|null>(null);
 const [crumbs,setCrumbs]=useState<{name:string;href:string}[]>([]),[sharing,setSharing]=useState(false),[sending,setSending]=useState(false),[preview,setPreview]=useState(false);
 const [resps,setResps]=useState<Resp[]|null>(null),[respErr,setRespErr]=useState('');
 const latest=useRef<{form:Form|null;title:string}>({form:null,title:''}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),live=useRef<ReturnType<typeof db.channel>|null>(null);
 const canEdit=role==='owner'||role==='edit';

 useEffect(()=>{let on=true;void (async()=>{
  const [{data:d},{data:r}]=await Promise.all([db.from('zarn_docs').select('id,title,content,owner_id,kind,drive,folder_id,lead_id').eq('id',id).maybeSingle(),db.rpc('zarn_doc_role',{d:id})]);
  if(!on)return;
  const x=d as Row|null;
  if(x&&x.kind!=='form'){router.replace(x.kind==='sheet'?`/zarn/sheets/${id}`:`/zarn/docs/${id}`);return;}
  if(!x||r!=='owner'&&r!=='edit'){router.replace(`/f/${id}`);return;}
  setRow(x);setRole((r as Role|null)??null);
  if(x){const f=readForm(x.content);setForm(f);setTitle(x.title);latest.current={form:f,title:x.title};
   void db.from('zarn_drive_opens').upsert({user_id:me.user_id,kind:'doc',item_id:id,opened_at:new Date().toISOString()});}
 })();return()=>{on=false;};},[db,id,me.user_id,router]);

 useEffect(()=>{if(!row)return;let on=true;void (async()=>{
  const client=channels.find(c=>c.kind==='client'&&c.lead_id===row.lead_id);
  const root=row.drive==='team'?{name:'Team drive',href:'/zarn/drive?v=team'}:row.drive==='client'?{name:client?chTitle(client):'Client drive',href:`/zarn/drive?v=client&l=${row.lead_id}`}:row.owner_id===me.user_id?{name:'My Drive',href:'/zarn/drive?v=my'}:{name:'Shared with me',href:'/zarn/drive?v=shared'};
  const trail:{name:string;href:string}[]=[];let f=row.folder_id,h=0;
  while(f&&h<20){const {data:x}=await db.from('zarn_drive_folders').select('id,name,parent_id').eq('id',f).maybeSingle();if(!x)break;trail.unshift({name:x.name as string,href:`/zarn/drive?f=${x.id}`});f=x.parent_id as string|null;h++;}
  if(on)setCrumbs([root,...trail]);})();return()=>{on=false;};},[row,db,channels,chTitle,me.user_id]);

 const save=useCallback(async()=>{timer.current=null;if(!latest.current.form)return;setState('saving');
  const {error}=await db.from('zarn_docs').update({title:latest.current.title.trim()||'Untitled form',content:JSON.stringify(latest.current.form),updated_by:me.user_id}).eq('id',id);
  setState(error?'error':'saved');},[db,id,me.user_id]);
 const queue=useCallback(()=>{setState('saving');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void save(),700);},[save]);
 useEffect(()=>()=>{if(timer.current){clearTimeout(timer.current);void save();}},[save]);
 // Every change saves itself and is sent to anyone else editing the form.
 const change=useCallback((fn:(f:Form)=>Form)=>{const cur=latest.current.form;if(!cur)return;const next=fn(cur);latest.current.form=next;setForm(next);queue();
  void live.current?.send({type:'broadcast',event:'full',payload:{form:next,title:latest.current.title}});},[queue]);
 const setQ=(qid:string,patch:Partial<Q>)=>change(f=>({...f,qs:f.qs.map(q=>q.id===qid?{...q,...patch}:q)}));
 const setSet=(patch:Partial<Form['set']>)=>change(f=>({...f,set:{...f.set,...patch}}));
 useEffect(()=>{
  if(!row)return;
  const ch=db.channel(`zarn-form:${id}`);
  ch.on('broadcast',{event:'full'},({payload}:{payload:unknown})=>{const p=payload as {form:Form;title:string};latest.current={form:p.form,title:p.title};setForm(p.form);setTitle(p.title);}).subscribe();
  live.current=ch;return()=>{live.current=null;void db.removeChannel(ch);};
 },[db,id,row]);

 const loadResps=useCallback(async()=>{setRespErr('');const {data,error}=await db.from('zarn_form_responses').select('id,user_id,email,answers,created_at').eq('doc_id',id).order('created_at',{ascending:false}).limit(5000);
  if(error){setRespErr('Responses aren’t switched on for this workspace yet.');setResps([]);return;}setResps(data as Resp[]);},[db,id]);
 useEffect(()=>{if(!canEdit)return;let on=true;void (async()=>{if(on)await loadResps();})();return()=>{on=false;};},[canEdit,loadResps,tab]);

 function addQ(t:QType){const q=!isAsk({id:'',t,title:''})?{id:newQid(),t,title:''}:blankQ(t);
  change(f=>{const i=focus?f.qs.findIndex(x=>x.id===focus):-1;const qs=[...f.qs];qs.splice(i<0?qs.length:i+1,0,q);return {...f,qs};});setFocus(q.id);
  setTimeout(()=>document.getElementById(`zfe-${q.id}`)?.scrollIntoView({behavior:'smooth',block:'center'}),50);}
 function move(qid:string,d:-1|1){change(f=>{const i=f.qs.findIndex(q=>q.id===qid),j=i+d;if(i<0||j<0||j>=f.qs.length)return f;const qs=[...f.qs];[qs[i],qs[j]]=[qs[j],qs[i]];return {...f,qs};});}
 function dup(q:Q){const c={...q,id:newQid(),opts:q.opts?[...q.opts]:undefined};change(f=>{const i=f.qs.findIndex(x=>x.id===q.id);const qs=[...f.qs];qs.splice(i+1,0,c);return {...f,qs};});setFocus(c.id);}
 function drop(q:Q){change(f=>({...f,qs:f.qs.filter(x=>x.id!==q.id)}));setFocus(null);}

 const who=useCallback((r:Resp)=>r.user_id?(people[r.user_id]?.display_name??'Former member'):r.email??'Anonymous',[people]);
 function csv(){if(!form||!resps)return;const rows=responseRows(form,resps,who);
  const text=rows.map(r=>r.map(c=>/[",\n]/.test(c)?`"${c.replace(/"/g,'""')}"`:c).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+text],{type:'text/csv'}));a.download=`${(title||'Form').replace(/[\\/:*?"<>|]/g,'')} (Responses).csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
 // Puts every response into a sheet beside the form (made the first time, refreshed after), then opens it.
 const [sheetBusy,setSheetBusy]=useState(false);
 async function toSheet(){
  if(!form||!resps||!row)return;setSheetBusy(true);
  const rows=responseRows(form,resps,who),cells:Record<string,string>={},style:Record<string,{b:1}>={};
  rows.forEach((r,ri)=>r.forEach((c,ci)=>{if(c!==''){const k=ref(ci,ri);cells[k]=/^[=+\-@]/.test(c)?`'${c}`:c;if(ri===0)style[k]={b:1};}}));
  const widths:Record<string,number>={};rows[0].forEach((_,i)=>{widths[i]=i===0?160:200;});
  const content=JSON.stringify({tabs:[{id:'s1',name:'Form responses 1',cells,style,widths,freeze:{r:1,c:0}}]});
  let sid=form.set.sheet;
  if(sid){const {data}=await db.from('zarn_docs').update({content,updated_by:me.user_id}).eq('id',sid).is('trashed_at',null).select('id');if(!data?.length)sid=undefined;}
  if(!sid){sid=crypto.randomUUID();
   const {error}=await db.from('zarn_docs').insert({id:sid,owner_id:me.user_id,kind:'sheet',title:`${title||'Untitled form'} (Responses)`,content,folder_id:row.folder_id,...(row.folder_id?{}:{drive:row.drive,...(row.drive==='client'?{lead_id:row.lead_id}:{})})});
   if(error){setSheetBusy(false);setRespErr('Could not make the sheet.');return;}
   setSet({sheet:sid});await save();}
  setSheetBusy(false);router.push(`/zarn/sheets/${sid}`);
 }
 async function trash(){if(!await confirm({title:'Move this form to the trash?',message:'People can’t answer it while it’s in the trash. You can restore it from Drive.',confirm:'Move to trash'}))return;
  await db.from('zarn_docs').update({trashed_at:new Date().toISOString()}).eq('id',id);router.push(crumbs.at(-1)?.href??'/zarn/drive');}

 if(row===undefined||(row&&!form))return <div className="zn-page"><p className="zn-loading">Loading…</p></div>;
 if(!row||!role||!form)return <div className="zn-page"><div className="zn-empty-state"><h2>Form not found</h2><p>It may have been deleted, or it isn’t shared with you.</p><Link className="zn-btn" href="/zarn/drive">Back to Drive</Link></div></div>;
 if(preview)return <div className="zn-page zfe-previewpage"><FormFill id={id} title={title} form={form} who={me.display_name} preview onExit={()=>setPreview(false)}/></div>;
 const color=form.set.color||FORM_COLORS[0];
 const link=`${SHARE_BASE}/f/${id}`;
 const n=resps?.length??0;
 return <div className="zn-page zfe" style={{'--zfe':color} as React.CSSProperties} onClick={()=>setFocus(null)}>
  {sharing&&<ShareDoc docId={id} onClose={()=>setSharing(false)}/>}
  {sending&&<SendForm link={link} form={form} onWho={v=>setSet({who:v})} canEdit={canEdit} onClose={()=>setSending(false)}/>}
  <header className="zfe-top" onClick={e=>e.stopPropagation()}>
   <Link href={crumbs.at(-1)?.href??'/zarn/drive'} className="zfe-logo" aria-label="Back to Drive" data-tip="Back to Drive"><ClipboardList size={24}/></Link>
   <div className="zfe-titles">
    <input className="zs2-title" value={title} readOnly={!canEdit} maxLength={200} placeholder="Untitled form" aria-label="Form name" size={Math.max(6,(title||'Untitled form').length)}
     onChange={e=>{setTitle(e.target.value);latest.current.title=e.target.value;queue();void live.current?.send({type:'broadcast',event:'full',payload:{form:latest.current.form,title:e.target.value}});}}/>
    <span className="zs2-loc"><span className="zs2-crumbs" title="Location in Drive"><Folder size={13}/>{crumbs.map((c,i)=><span key={c.href}>{i>0&&<ChevronRight size={12}/>}<Link href={c.href}>{c.name}</Link></span>)}</span>
     <span className={`zs2-state${state==='error'?' is-error':''}`}>{!canEdit?'View only':state==='saving'?<><Loader2 size={13} className="zn-spin"/>Saving…</>:state==='error'?<><CloudOff size={14}/>Not saved</>:<><CloudCheck size={14}/>Saved</>}</span></span>
   </div>
   <div className="zfe-right">
    <button type="button" className="zfe-ibtn" aria-label="Preview" data-tip="Preview" onClick={()=>setPreview(true)}><Eye size={19}/></button>
    {canEdit&&<button type="button" className="zfe-ibtn" aria-label="Move to trash" data-tip="Move to trash" onClick={()=>void trash()}><Trash2 size={18}/></button>}
    {canEdit&&<button type="button" className="zn-btn zfe-hide-sm" onClick={()=>setSharing(true)}><Share2 size={15}/>Share</button>}
    <button type="button" className="zn-btn is-primary zfe-send" onClick={()=>setSending(true)}><Send size={15}/>Send</button>
   </div>
  </header>
  <nav className="zfe-tabs" role="tablist" onClick={e=>e.stopPropagation()}>
   {([['questions','Questions'],['responses','Responses'],['settings','Settings']] as const).filter(([t])=>canEdit||t==='questions').map(([t,l])=><button key={t} type="button" role="tab" aria-selected={tab===t} className={tab===t?'is-on':''} onClick={()=>setTab(t)}>{l}{t==='responses'&&n>0&&<span className="zfe-count">{n}</span>}</button>)}
  </nav>
  <div className="zfe-body">
   {tab==='questions'&&<div className="zfe-col">
    <div className={`zfe-card zfe-headcard${focus==='__head'?' is-on':''}`} onClick={e=>{e.stopPropagation();if(canEdit)setFocus('__head');}}>
     <input className="zfe-h1" value={title} readOnly={!canEdit} placeholder="Untitled form" maxLength={200} aria-label="Form title" onChange={e=>{setTitle(e.target.value);latest.current.title=e.target.value;queue();}}/>
     <AutoArea className="zfe-desc" value={form.desc} readOnly={!canEdit} placeholder="Form description" onChange={v=>change(f=>({...f,desc:v}))}/>
    </div>
    {form.qs.map((q,i)=><QCard key={q.id} q={q} on={canEdit&&focus===q.id} canEdit={canEdit} first={i===0} last={i===form.qs.length-1}
     onFocus={()=>{if(canEdit)setFocus(q.id);}} onChange={p=>setQ(q.id,p)} onMove={d=>move(q.id,d)} onDup={()=>dup(q)} onDrop={()=>drop(q)}/>)}
    {canEdit&&<div className="zfe-tools" onClick={e=>e.stopPropagation()}>
     <button type="button" aria-label="Add question" data-tip="Add question" onClick={()=>addQ('radio')}><Plus size={20}/><span>Question</span></button>
     <button type="button" aria-label="Add title and description" data-tip="Add title and description" onClick={()=>addQ('section')}><Heading size={18}/><span>Title</span></button>
     <button type="button" aria-label="Add page break" data-tip="Add page break" onClick={()=>addQ('page')}><SeparatorHorizontal size={18}/><span>Page</span></button>
    </div>}
    {!form.qs.length&&<p className="zfe-empty">No questions yet. Add one to get started.</p>}
   </div>}
   {tab==='responses'&&canEdit&&<Responses form={form} resps={resps} err={respErr} who={who} people={people} sheet={!!form.set.sheet} sheetBusy={sheetBusy}
     onOpen={v=>setSet({open:v})} onCsv={csv} onSheet={()=>void toSheet()} onRefresh={()=>void loadResps()}
     onDelete={async r=>{if(!await confirm({title:'Delete this response?',message:'It’s removed for good.',confirm:'Delete'}))return;setResps(l=>l?.filter(x=>x.id!==r.id)??l);await db.from('zarn_form_responses').delete().eq('id',r.id);}}
     onDeleteAll={async()=>{if(!await confirm({title:'Delete all responses?',message:`All ${n} responses are removed for good.`,confirm:'Delete all'}))return;setResps([]);await db.from('zarn_form_responses').delete().eq('doc_id',id);}}/>}
   {tab==='settings'&&canEdit&&<div className="zfe-col" onClick={e=>e.stopPropagation()}>
    <section className="zfe-card zfe-set">
     <h2>Responses</h2>
     <div className="zfe-setrow"><div><b>Accepting responses</b><small>{form.set.open?'People with the link can answer.':'The form shows a closed message.'}</small></div><Switch on={form.set.open} onChange={v=>setSet({open:v})} label="Accepting responses"/></div>
     <div className="zfe-setrow"><div><b>Who can respond</b><small>{form.set.who==='team'?'Only people signed in to ZARN as team members.':'Anyone with the link, no sign-in needed.'}</small></div>
      <Dropdown variant="inline" label="Who can respond" value={form.set.who} onChange={v=>setSet({who:v as 'team'|'anyone'})} options={[{value:'team',label:'Only the team'},{value:'anyone',label:'Anyone with the link'}]}/></div>
     {form.set.who==='anyone'&&<div className="zfe-setrow"><div><b>Collect email addresses</b><small>People outside ZARN must type their email. Team members are recorded by name anyway.</small></div><Switch on={!!form.set.email} onChange={v=>setSet({email:v?1:undefined})} label="Collect email addresses"/></div>}
     <div className="zfe-setrow"><div><b>Limit to 1 response</b><small>{form.set.who==='team'?'Each team member can answer once.':'Applies to people signed in to ZARN. People outside ZARN can’t be told apart.'}</small></div><Switch on={!!form.set.once} onChange={v=>setSet({once:v?1:undefined})} label="Limit to 1 response"/></div>
     <div className="zfe-setrow"><div><b>Notify me of new responses</b><small>A notification on your devices each time someone answers.</small></div><Switch on={!!form.set.notify} onChange={v=>setSet({notify:v?1:undefined})} label="Notify me of new responses"/></div>
     {canLead&&<div className="zfe-setrow"><div><b>Add answers to Business as leads</b><small>Each response becomes a new lead in Business, using the questions titled Name, Email, Company and Phone. Admins get a notification.</small></div><Switch on={!!form.set.lead} onChange={v=>setSet({lead:v?1:undefined})} label="Add answers to Business as leads"/></div>}
    </section>
    <section className="zfe-card zfe-set">
     <h2>Presentation</h2>
     <label className="zn-label">Confirmation message<AutoArea className="zn-input zfe-area" value={form.set.done??''} placeholder="Your response has been recorded." onChange={v=>setSet({done:v||undefined})}/></label>
     <div className="zn-label">Colour<div className="zfe-swatches">{FORM_COLORS.map(c=><button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color===c} style={{background:c}} onClick={()=>setSet({color:c})}>{color===c&&<Check size={15}/>}</button>)}</div></div>
    </section>
   </div>}
  </div>
 </div>;
}

function Switch({on,onChange,label}:{on:boolean;onChange:(v:boolean)=>void;label:string}){
 return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`zfe-switch${on?' is-on':''}`} onClick={()=>onChange(!on)}><i/></button>;
}
function AutoArea({value,onChange,className,placeholder,readOnly}:{value:string;onChange:(v:string)=>void;className:string;placeholder?:string;readOnly?:boolean}){
 const el=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const t=el.current;if(t){t.style.height='auto';t.style.height=`${t.scrollHeight}px`;}},[value]);
 return <textarea ref={el} rows={1} className={className} value={value} readOnly={readOnly} placeholder={placeholder} maxLength={5000} onChange={e=>onChange(e.target.value)}/>;
}

// One question. Click it to edit (title, type, options, required); otherwise it shows as people will see it.
function QCard({q,on,canEdit,first,last,onFocus,onChange,onMove,onDup,onDrop}:{q:Q;on:boolean;canEdit:boolean;first:boolean;last:boolean;onFocus:()=>void;onChange:(p:Partial<Q>)=>void;onMove:(d:-1|1)=>void;onDup:()=>void;onDrop:()=>void}){
 const opts=q.opts??[];
 const setType=(t:QType)=>onChange({t,...(hasOpts(t)&&!opts.length?{opts:['Option 1']}:{}),...(t==='scale'&&q.min===undefined?{min:1,max:5}:{})});
 const setOpt=(i:number,v:string)=>onChange({opts:opts.map((o,j)=>j===i?v:o)});
 const mark=(i:number)=>q.t==='check'?<Square size={18}/>:q.t==='drop'?<span className="zfe-num">{i+1}.</span>:<CircleDot size={18} className="zfe-dot"/>;
 if(!isAsk(q))return <div id={`zfe-${q.id}`} className={`zfe-card zfe-section${q.t==='page'?' is-page':''}${on?' is-on':''}`} onClick={e=>{e.stopPropagation();onFocus();}}>
  {q.t==='page'&&<span className="zfe-pagetag"><SeparatorHorizontal size={14}/>New page starts here</span>}
  <input className="zfe-qtitle is-section" value={q.title} readOnly={!on} placeholder={q.t==='page'?'Page title (optional)':'Untitled title'} maxLength={300} onChange={e=>onChange({title:e.target.value})}/>
  {(on||q.help)&&<AutoArea className="zfe-desc" value={q.help??''} readOnly={!on} placeholder="Description (optional)" onChange={v=>onChange({help:v||undefined})}/>}
  {on&&<div className="zfe-qfoot"><span/><Actions first={first} last={last} onMove={onMove} onDup={onDup} onDrop={onDrop}/></div>}
 </div>;
 return <div id={`zfe-${q.id}`} className={`zfe-card zfe-q${on?' is-on':''}`} onClick={e=>{e.stopPropagation();onFocus();}}>
  {canEdit&&<span className="zfe-grip" aria-hidden="true"><GripVertical size={16}/></span>}
  {on?<>
   <div className="zfe-qrow">
    <AutoArea className="zfe-qtitle" value={q.title} placeholder="Question" onChange={v=>onChange({title:v})}/>
    <Dropdown className="zfe-type" label="Question type" value={q.t} onChange={v=>setType(v as QType)} options={QTYPES.filter(x=>isAsk({id:'',t:x.t,title:''})).map(x=>({value:x.t,label:x.label}))}/>
   </div>
   <AutoArea className="zfe-help" value={q.help??''} placeholder="Description (optional)" onChange={v=>onChange({help:v||undefined})}/>
   {hasOpts(q.t)&&<div className="zfe-opts">
    {opts.map((o,i)=><div key={i} className="zfe-opt">{mark(i)}<input value={o} maxLength={300} aria-label={`Option ${i+1}`} onChange={e=>setOpt(i,e.target.value)} onBlur={e=>{if(!e.target.value.trim())setOpt(i,`Option ${i+1}`);}}
     onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onChange({opts:[...opts.slice(0,i+1),`Option ${opts.length+1}`,...opts.slice(i+1)]});setTimeout(()=>{const ins=(e.target as HTMLElement).closest('.zfe-opts')?.querySelectorAll('input');(ins?.[i+1] as HTMLInputElement|undefined)?.select();},30);}}}/>
     {opts.length>1&&<button type="button" className="zfe-x" aria-label="Remove option" onClick={()=>onChange({opts:opts.filter((_,j)=>j!==i)})}><X size={16}/></button>}</div>)}
    {q.other&&<div className="zfe-opt">{mark(opts.length)}<span className="zfe-other">Other…</span><button type="button" className="zfe-x" aria-label="Remove Other" onClick={()=>onChange({other:undefined})}><X size={16}/></button></div>}
    <div className="zfe-opt is-add">{mark(opts.length+(q.other?1:0))}<button type="button" className="zfe-addopt" onClick={()=>onChange({opts:[...opts,`Option ${opts.length+1}`]})}>Add option</button>
     {!q.other&&q.t!=='drop'&&<><span className="zfe-or">or</span><button type="button" className="zfe-addother" onClick={()=>onChange({other:1})}>add “Other”</button></>}</div>
   </div>}
   {q.t==='scale'&&<div className="zfe-scale">
    <div className="zfe-scale-range"><select aria-label="From" value={q.min??1} onChange={e=>onChange({min:Number(e.target.value)})}>{[0,1].map(v=><option key={v} value={v}>{v}</option>)}</select><span>to</span>
     <select aria-label="To" value={q.max??5} onChange={e=>onChange({max:Number(e.target.value)})}>{[2,3,4,5,6,7,8,9,10].map(v=><option key={v} value={v}>{v}</option>)}</select></div>
    <label><span>{q.min??1}</span><input className="zfe-line" value={q.lo??''} placeholder="Label (optional)" maxLength={60} onChange={e=>onChange({lo:e.target.value||undefined})}/></label>
    <label><span>{q.max??5}</span><input className="zfe-line" value={q.hi??''} placeholder="Label (optional)" maxLength={60} onChange={e=>onChange({hi:e.target.value||undefined})}/></label>
   </div>}
   {(q.t==='short'||q.t==='para'||q.t==='date'||q.t==='time')&&<p className={`zfe-fake${q.t==='para'?' is-long':''}`}>{q.t==='short'?'Short answer text':q.t==='para'?'Long answer text':q.t==='date'?'Day, month, year':'Time'}</p>}
   <div className="zfe-qfoot"><label className="zfe-req">Required<Switch on={!!q.req} onChange={v=>onChange({req:v?1:undefined})} label="Required"/></label><Actions first={first} last={last} onMove={onMove} onDup={onDup} onDrop={onDrop}/></div>
  </>:<>
   <div className="zfe-qview">{q.title||<span className="zfe-muted">Untitled question</span>}{q.req&&<span className="zfe-star">*</span>}</div>
   {q.help&&<p className="zfe-helpview">{q.help}</p>}
   {hasOpts(q.t)&&<div className="zfe-opts is-view">{opts.map((o,i)=><div key={i} className="zfe-opt">{mark(i)}<span>{o}</span></div>)}{q.other&&<div className="zfe-opt">{mark(opts.length)}<span>Other…</span></div>}</div>}
   {q.t==='scale'&&<div className="zfe-scaleview">{q.lo&&<span>{q.lo}</span>}{Array.from({length:(q.max??5)-(q.min??1)+1},(_,i)=><span key={i} className="zfe-scalen"><b>{(q.min??1)+i}</b><CircleDot size={18} className="zfe-dot"/></span>)}{q.hi&&<span>{q.hi}</span>}</div>}
   {(q.t==='short'||q.t==='para'||q.t==='date'||q.t==='time')&&<p className={`zfe-fake${q.t==='para'?' is-long':''}`}>{q.t==='short'?'Short answer text':q.t==='para'?'Long answer text':q.t==='date'?'Day, month, year':'Time'}</p>}
  </>}
 </div>;
}
function Actions({first,last,onMove,onDup,onDrop}:{first:boolean;last:boolean;onMove:(d:-1|1)=>void;onDup:()=>void;onDrop:()=>void}){
 return <div className="zfe-acts">
  <button type="button" aria-label="Move up" data-tip="Move up" disabled={first} onClick={()=>onMove(-1)}><ArrowUp size={17}/></button>
  <button type="button" aria-label="Move down" data-tip="Move down" disabled={last} onClick={()=>onMove(1)}><ArrowDown size={17}/></button>
  <button type="button" aria-label="Duplicate" data-tip="Duplicate" onClick={onDup}><Copy size={17}/></button>
  <button type="button" aria-label="Delete" data-tip="Delete" onClick={onDrop}><Trash2 size={17}/></button>
 </div>;
}

function SendForm({link,form,canEdit,onWho,onClose}:{link:string;form:Form;canEdit:boolean;onWho:(v:'team'|'anyone')=>void;onClose:()=>void}){
 const [copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{}}
 return <Modal title="Send form" onClose={onClose}><div className="zn-modal-body zfe-sendbox">
  <label className="zn-label">Link<div className="zfe-linkrow"><input className="zn-input" readOnly value={link} onFocus={e=>e.currentTarget.select()}/><button type="button" className="zn-btn is-primary" onClick={()=>void copy()}>{copied?<Check size={15}/>:<Link2 size={15}/>}{copied?'Copied':'Copy'}</button></div></label>
  <div className="zn-label">Who can respond<Dropdown label="Who can respond" disabled={!canEdit} value={form.set.who} onChange={v=>onWho(v as 'team'|'anyone')} options={[{value:'team',label:'Only the team (sign in to ZARN)'},{value:'anyone',label:'Anyone with the link'}]}/></div>
  {!form.set.open&&<p className="zn-note">This form isn’t accepting responses. Turn it on under Responses.</p>}
  <p className="zfe-muted">Paste the link in a chat, an email or a post. To let someone edit the questions, use Share instead.</p>
  <div className="zn-modal-foot"><a className="zn-btn" href={link.replace(SHARE_BASE,'')} target="_blank" rel="noopener noreferrer">Open form</a><button type="button" className="zn-btn is-primary" onClick={onClose}>Done</button></div>
 </div></Modal>;
}

// Responses: a summary per question (bars for choices, a list for text), each response one at a time, CSV and a linked sheet.
function Responses({form,resps,err,who,people,sheet,sheetBusy,onOpen,onCsv,onSheet,onRefresh,onDelete,onDeleteAll}:{form:Form;resps:Resp[]|null;err:string;who:(r:Resp)=>string;people:Record<string,import('@/lib/zarn').ZMember>;sheet:boolean;sheetBusy:boolean;
 onOpen:(v:boolean)=>void;onCsv:()=>void;onSheet:()=>void;onRefresh:()=>void;onDelete:(r:Resp)=>void;onDeleteAll:()=>void}){
 const [view,setView]=useState<'summary'|'one'>('summary'),[at,setAt]=useState(0);
 const list=useMemo(()=>resps??[],[resps]),n=list.length,qs=useMemo(()=>form.qs.filter(isAsk),[form.qs]);
 const one=list[Math.min(at,Math.max(0,n-1))];
 const stats=useMemo(()=>qs.map(q=>{
  const vals=list.map(r=>r.answers[q.id]).filter(v=>v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length));
  if(hasOpts(q.t)||q.t==='scale'){
   const keys=q.t==='scale'?Array.from({length:(q.max??5)-(q.min??1)+1},(_,i)=>String((q.min??1)+i)):[...(q.opts??[]),...(q.other?['Other']:[])];
   const c=new Map(keys.map(k=>[k,0]));
   for(const v of vals)for(const s of Array.isArray(v)?v:[v]){const k=s.startsWith(OTHER)?'Other':s;c.set(k,(c.get(k)??0)+1);}
   return {q,answered:vals.length,bars:[...c.entries()],texts:vals.flatMap(v=>(Array.isArray(v)?v:[v]).filter(s=>s.startsWith(OTHER)).map(s=>s.slice(OTHER.length)))};
  }
  return {q,answered:vals.length,bars:null,texts:vals.map(v=>answerText(q,v))};
 }),[qs,list]);
 return <div className="zfe-col" onClick={e=>e.stopPropagation()}>
  <section className="zfe-card zfe-rhead">
   <div className="zfe-rtop"><h2>{resps===null?'Loading…':`${n} response${n===1?'':'s'}`}</h2>
    <div className="zfe-racts">
     <button type="button" className="zn-btn" disabled={sheetBusy||!n} onClick={onSheet}>{sheetBusy?<Loader2 size={15} className="zn-spin"/>:<FileSpreadsheet size={15}/>}{sheet?'View in Sheets':'Link to Sheets'}</button>
     <button type="button" className="zfe-ibtn" aria-label="Download CSV" data-tip="Download CSV" disabled={!n} onClick={onCsv}><Download size={18}/></button>
     <button type="button" className="zfe-ibtn" aria-label="Refresh" data-tip="Refresh" onClick={onRefresh}><RefreshCw size={17}/></button>
     {n>0&&<button type="button" className="zfe-ibtn" aria-label="Delete all responses" data-tip="Delete all responses" onClick={onDeleteAll}><Trash2 size={17}/></button>}
    </div></div>
   <div className="zfe-setrow"><div><b>Accepting responses</b><small>{form.set.open?'The form is open.':'People see that the form is closed.'}</small></div><Switch on={form.set.open} onChange={onOpen} label="Accepting responses"/></div>
   {err&&<p className="zn-error">{err}</p>}
   {n>0&&<div className="zfe-subtabs" role="tablist"><button type="button" role="tab" aria-selected={view==='summary'} className={view==='summary'?'is-on':''} onClick={()=>setView('summary')}>Summary</button><button type="button" role="tab" aria-selected={view==='one'} className={view==='one'?'is-on':''} onClick={()=>setView('one')}>Individual</button></div>}
  </section>
  {resps!==null&&!n&&!err&&<p className="zfe-empty">Waiting for responses. Press Send to share the form.</p>}
  {n>0&&view==='summary'&&stats.map(s=><section key={s.q.id} className="zfe-card zfe-stat">
   <h3>{s.q.title||'Untitled question'}</h3><small>{s.answered} response{s.answered===1?'':'s'}</small>
   {s.bars?<div className="zfe-bars">{s.bars.map(([k,c])=>{const pct=s.answered?Math.round(c/s.answered*100):0;return <div key={k} className="zfe-bar"><span className="zfe-bar-l" title={k}>{k}</span><span className="zfe-bar-t"><i style={{width:`${pct}%`}}/></span><span className="zfe-bar-n">{c} <small>({pct}%)</small></span></div>;})}</div>:null}
   {s.texts.length>0&&<ul className="zfe-texts">{s.texts.slice(0,100).map((t,i)=><li key={i}>{t}</li>)}{s.texts.length>100&&<li className="zfe-muted">and {s.texts.length-100} more. Download the CSV to see all.</li>}</ul>}
  </section>)}
  {n>0&&view==='one'&&one&&<>
   <section className="zfe-card zfe-pager">
    <button type="button" className="zfe-ibtn" aria-label="Previous response" disabled={at<=0} onClick={()=>setAt(a=>a-1)}><ChevronLeft size={18}/></button>
    <span>{Math.min(at,n-1)+1} of {n}</span>
    <button type="button" className="zfe-ibtn" aria-label="Next response" disabled={at>=n-1} onClick={()=>setAt(a=>a+1)}><ChevronRight size={18}/></button>
    <span className="zfe-who">{one.user_id&&<Avatar m={people[one.user_id]} size={22}/>}<b>{who(one)}</b><small>{new Date(one.created_at).toLocaleString(undefined,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})}</small></span>
    <button type="button" className="zfe-ibtn" aria-label="Delete response" data-tip="Delete response" onClick={()=>{onDelete(one);setAt(a=>Math.max(0,Math.min(a,n-2)));}}><Trash2 size={17}/></button>
   </section>
   {qs.map(q=><section key={q.id} className="zfe-card zfe-answer"><h3>{q.title||'Untitled question'}</h3><p>{answerText(q,one.answers[q.id])||<span className="zfe-muted">No answer</span>}</p></section>)}
  </>}
 </div>;
}
