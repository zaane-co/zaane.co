'use client';
// Side panels and dialogs for the sheet editor: version history, protected ranges and the pivot table editor.
import {useCallback,useEffect,useState} from 'react';
import {Check,History,Loader2,Lock,Pencil,Plus,RotateCcw,ShieldAlert,Trash2,X} from 'lucide-react';
import {Modal} from './Dialogs';
import {Avatar} from './format';
import type {ZMember} from '@/lib/zarn';
import {colName,parseRange,readSheet,ref,type Pivot,type PivFn,type Prot,type SheetData,type Tab} from '@/lib/sheet';

const newId=()=>Math.random().toString(36).slice(2,10);
const fmtWhen=(s:string)=>new Date(s).toLocaleString(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
const dayOf=(s:string)=>{const d=new Date(s),t=new Date();const y=new Date();y.setDate(t.getDate()-1);
 return d.toDateString()===t.toDateString()?'Today':d.toDateString()===y.toDateString()?'Yesterday':d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:d.getFullYear()===t.getFullYear()?undefined:'numeric'});};

// ---------- Version history ----------
export type Ver={id:string;title:string;name:string|null;created_by:string|null;created_at:string};
type Db=ReturnType<typeof import('./ZarnProvider').useZarn>['db'];
export function VersionPanel({db,docId,people,canEdit,isOwner,previewId,onPreview,onRestore,onClose}:{db:Db;docId:string;people:Record<string,ZMember>;canEdit:boolean;isOwner:boolean;previewId:string|null;
 onPreview:(v:{id:string;label:string;data:SheetData}|null)=>void;onRestore:(data:SheetData,label:string)=>void;onClose:()=>void}){
 const [list,setList]=useState<Ver[]|null>(null),[err,setErr]=useState(''),[named,setNamed]=useState(false),[busy,setBusy]=useState<string|null>(null),[naming,setNaming]=useState<string|null>(null);
 const load=useCallback(async()=>{const {data,error}=await db.from('zarn_doc_versions').select('id,title,name,created_by,created_at').eq('doc_id',docId).order('created_at',{ascending:false}).limit(200);
  if(error){setErr('Version history is not switched on for this workspace yet.');setList([]);return;}setList(data as Ver[]);},[db,docId]);
 useEffect(()=>{let on=true;void (async()=>{if(on)await load();})();return()=>{on=false;};},[load]);
 const label=(v:Ver)=>v.name||fmtWhen(v.created_at);
 async function open(v:Ver){if(previewId===v.id)return;setBusy(v.id);const {data}=await db.from('zarn_doc_versions').select('content').eq('id',v.id).maybeSingle();setBusy(null);
  if(data)onPreview({id:v.id,label:label(v),data:readSheet((data as {content:string}).content)});}
 async function restore(v:Ver){setBusy(v.id);const {data}=await db.from('zarn_doc_versions').select('content').eq('id',v.id).maybeSingle();setBusy(null);if(data)onRestore(readSheet((data as {content:string}).content),label(v));}
 async function rename(v:Ver,name:string){setNaming(null);const n=name.trim()||null;setList(l=>l?.map(x=>x.id===v.id?{...x,name:n}:x)??l);await db.from('zarn_doc_versions').update({name:n}).eq('id',v.id);}
 async function drop(v:Ver){setList(l=>l?.filter(x=>x.id!==v.id)??l);if(previewId===v.id)onPreview(null);await db.from('zarn_doc_versions').delete().eq('id',v.id);}
 const shown=(list??[]).filter(v=>!named||v.name),days=shown.map(v=>dayOf(v.created_at));
 return <aside className="zs2-side" aria-label="Version history">
  <header><History size={17}/><b>Version history</b><button type="button" className="zs2-ticon" aria-label="Close" onClick={onClose}><X size={16}/></button></header>
  <label className="zs2-side-opt"><input type="checkbox" checked={named} onChange={e=>setNamed(e.target.checked)}/>Only show named versions</label>
  <div className="zs2-side-body">
   <button type="button" className={`zs2-ver${previewId===null?' is-on':''}`} onClick={()=>onPreview(null)}><b>Current version</b><small>What everyone sees now</small></button>
   {list===null?<p className="zs2-side-note"><Loader2 size={15} className="zn-spin"/>Loading…</p>:err?<p className="zs2-side-note">{err}</p>:!shown.length?<p className="zs2-side-note">{named?'No named versions yet.':'Earlier versions appear here as people edit. A copy is kept every 10 minutes or so while the sheet is being changed.'}</p>:null}
   {shown.map((v,i)=>{const day=days[i],head=i===0||day!==days[i-1];const who=v.created_by?people[v.created_by]:undefined;const on=previewId===v.id;
    return <div key={v.id}>{head&&<p className="zs2-ver-day">{day}</p>}
     <div className={`zs2-ver${on?' is-on':''}`} role="button" tabIndex={0} onClick={()=>void open(v)} onKeyDown={e=>{if(e.key==='Enter')void open(v);}}>
      {naming===v.id?<input autoFocus className="zn-input" defaultValue={v.name??''} placeholder="Name this version" maxLength={80} onClick={e=>e.stopPropagation()} onBlur={e=>void rename(v,e.currentTarget.value)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')void rename(v,e.currentTarget.value);if(e.key==='Escape')setNaming(null);}}/>
       :<b>{v.name??fmtWhen(v.created_at)}</b>}
      {v.name&&<small>{fmtWhen(v.created_at)}</small>}
      <span className="zs2-ver-who"><Avatar m={who} size={18} name={who?.display_name??'Former member'}/>{who?.display_name??'Former member'}{busy===v.id&&<Loader2 size={13} className="zn-spin"/>}</span>
      {on&&<span className="zs2-ver-acts" onClick={e=>e.stopPropagation()}>
       {canEdit&&<button type="button" className="zn-btn is-primary" onClick={()=>void restore(v)}><RotateCcw size={14}/>Restore this version</button>}
       {canEdit&&<button type="button" className="zn-btn" onClick={()=>setNaming(v.id)}><Pencil size={14}/>{v.name?'Rename':'Name'}</button>}
       {isOwner&&<button type="button" className="zn-btn" aria-label="Delete version" onClick={()=>void drop(v)}><Trash2 size={14}/></button>}
      </span>}
     </div></div>;})}
  </div>
 </aside>;
}

// ---------- Protected ranges ----------
export function ProtectPanel({prot,range,me,isOwner,members,onChange,onClose}:{prot:Prot[];range:string;me:string;isOwner:boolean;members:ZMember[];onChange:(p:Prot[])=>void;onClose:()=>void}){
 const [edit,setEdit]=useState<Prot|null>(prot.length?null:{id:newId(),range,by:me,eds:[]});
 const mine=(p:Prot)=>isOwner||p.by===me;
 const nameOf=(id:string)=>members.find(m=>m.user_id===id)?.display_name??'Someone';
 const who=(p:Prot)=>p.warn?'Shows a warning before editing':`Only ${[p.by,...(p.eds??[])].filter((x,i,a)=>a.indexOf(x)===i).map(x=>x===me?'you':nameOf(x)).join(', ')}${isOwner||p.by===me?'':' and the owner'} can edit`;
 if(edit)return <ProtectEditor p={edit} me={me} members={members} onCancel={()=>prot.length?setEdit(null):onClose()} onSave={x=>{const i=prot.findIndex(y=>y.id===x.id);onChange(i>=0?prot.map(y=>y.id===x.id?x:y):[...prot,x]);setEdit(null);}}/>;
 return <Modal title="Protected sheets and ranges" onClose={onClose}><div className="zn-modal-body zs2-cf">
  <ul className="zs2-cf-list">{prot.map(p=><li key={p.id}><button type="button" className="zs2-cf-item" disabled={!mine(p)} onClick={()=>setEdit(p)}>
   <span className="zs2-cf-sw zs2-prot-ico">{p.warn?<ShieldAlert size={16}/>:<Lock size={16}/>}</span>
   <span><b>{p.desc||(p.range?p.range:'Whole tab')}</b><small>{p.desc?`${p.range??'Whole tab'} · `:''}{who(p)}</small></span></button>
   {mine(p)&&<button type="button" className="zs2-rule-x" aria-label="Remove protection" onClick={()=>onChange(prot.filter(y=>y.id!==p.id))}><Trash2 size={15}/></button>}</li>)}</ul>
  <button type="button" className="zn-btn" onClick={()=>setEdit({id:newId(),range,by:me,eds:[]})}><Plus size={14}/>Add a sheet or range</button>
  <p className="zs2-side-note">Protection stops changes by accident. People who can edit the sheet still see protected cells, and the owner can always edit them.</p>
  <div className="zn-modal-foot"><button type="button" className="zn-btn is-primary" onClick={onClose}>Done</button></div>
 </div></Modal>;
}
function ProtectEditor({p,me,members,onCancel,onSave}:{p:Prot;me:string;members:ZMember[];onCancel:()=>void;onSave:(p:Prot)=>void}){
 const [whole,setWhole]=useState(!p.range),[range,setRange]=useState(p.range??''),[desc,setDesc]=useState(p.desc??''),[warn,setWarn]=useState(!!p.warn),[eds,setEds]=useState<string[]>(p.eds??[]),[err,setErr]=useState('');
 function save(e:React.FormEvent){e.preventDefault();let r2:string|undefined;
  if(!whole){const b=parseRange(range);if(!b){setErr('Enter a range like A1:D20.');return;}r2=b.c0===b.c1&&b.r0===b.r1?ref(b.c0,b.r0):`${ref(b.c0,b.r0)}:${ref(b.c1,b.r1)}`;}
  onSave({id:p.id,by:p.by,...(r2?{range:r2}:{}),...(desc.trim()?{desc:desc.trim()}:{}),...(warn?{warn:1 as const}:{eds:eds.filter(x=>x!==p.by)})});}
 return <Modal title="Protect a sheet or range" onClose={onCancel}><form className="zn-modal-body zs2-rule" onSubmit={save}>
  <label className="zn-label">Description (optional)<input className="zn-input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Totals, don't touch" maxLength={80}/></label>
  <div className="zs2-rule-type" role="radiogroup" aria-label="What to protect">{([[false,'Range'],[true,'Whole tab']] as const).map(([v,l])=><button key={l} type="button" role="radio" aria-checked={whole===v} className={whole===v?'is-on':''} onClick={()=>setWhole(v)}>{l}</button>)}</div>
  {!whole&&<label className="zn-label">Range<input className="zn-input" value={range} onChange={e=>setRange(e.target.value)} spellCheck={false} autoCapitalize="characters"/></label>}
  <div className="zn-label">Who can edit</div>
  <label className="zs2-side-opt"><input type="radio" name="pmode" checked={warn} onChange={()=>setWarn(true)}/>Anyone, but show a warning first</label>
  <label className="zs2-side-opt"><input type="radio" name="pmode" checked={!warn} onChange={()=>setWarn(false)}/>Only these people</label>
  {!warn&&<ul className="zs2-prot-people">{members.filter(m=>m.user_id!==p.by).map(m=><li key={m.user_id}><label><input type="checkbox" checked={eds.includes(m.user_id)} onChange={e=>setEds(x=>e.target.checked?[...x,m.user_id]:x.filter(y=>y!==m.user_id))}/><Avatar m={m} size={22}/>{m.display_name}</label></li>)}
   <li className="zs2-prot-fixed"><Check size={14}/>{p.by===me?'You':'Whoever set this up'} and the sheet owner can always edit</li></ul>}
  {err&&<p className="zn-error">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onCancel}>Cancel</button><button type="submit" className="zn-btn is-primary">Done</button></div>
 </form></Modal>;
}

// ---------- Pivot table editor ----------
const FNS:PivFn[]=['SUM','COUNTA','COUNT','AVERAGE','MIN','MAX'];
const FN_LABEL:Record<PivFn,string>={SUM:'SUM',COUNTA:'COUNTA (all values)',COUNT:'COUNT (numbers)',AVERAGE:'AVERAGE',MIN:'MIN',MAX:'MAX'};
export function PivotEditor({p,head,tabs,onChange,onClose}:{p:Pivot;head:string[];tabs:Tab[];onChange:(p:Pivot)=>void;onClose:()=>void}){
 const [range,setRange]=useState(p.range);
 const srcName=tabs.find(t=>t.id===p.src)?.name??'(deleted tab)';
 const fieldName=(i:number)=>head[i]??`Column ${colName(i)}`;
 const free=(used:number[])=>head.map((_,i)=>i).filter(i=>!used.includes(i));
 const listBlock=(key:'rows'|'cols',title:string)=><section className="zs2-piv-sec"><div className="zs2-piv-head"><b>{title}</b>
  <select aria-label={`Add to ${title}`} value="" onChange={e=>{const i=Number(e.target.value);onChange({...p,[key]:[...p[key],i]});}}><option value="" disabled>Add</option>{free([...p.rows,...p.cols]).map(i=><option key={i} value={i}>{fieldName(i)}</option>)}</select></div>
  {p[key].map((i,j)=><div key={`${i}-${j}`} className="zs2-piv-item"><span>{fieldName(i)}</span><button type="button" className="zs2-ticon" aria-label="Remove" onClick={()=>onChange({...p,[key]:p[key].filter((_,y)=>y!==j)})}><X size={14}/></button></div>)}</section>;
 return <aside className="zs2-side" aria-label="Pivot table editor">
  <header><b>Pivot table editor</b><button type="button" className="zs2-ticon" aria-label="Close" onClick={onClose}><X size={16}/></button></header>
  <div className="zs2-side-body">
   <section className="zs2-piv-sec"><div className="zs2-piv-head"><b>Data range</b><small>{srcName}</small></div>
    <input className="zn-input" value={range} spellCheck={false} onChange={e=>setRange(e.target.value)} onBlur={()=>{const b=parseRange(range);if(b&&range!==p.range)onChange({...p,range:`${ref(b.c0,b.r0)}:${ref(b.c1,b.r1)}`});else setRange(p.range);}} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/></section>
   {listBlock('rows','Rows')}
   {listBlock('cols','Columns')}
   <section className="zs2-piv-sec"><div className="zs2-piv-head"><b>Values</b>
    <select aria-label="Add a value" value="" onChange={e=>{const i=Number(e.target.value);onChange({...p,vals:[...p.vals,{c:i,fn:'SUM'}]});}}><option value="" disabled>Add</option>{head.map((_,i)=><option key={i} value={i}>{fieldName(i)}</option>)}</select></div>
    {p.vals.map((v,j)=><div key={j} className="zs2-piv-item"><span>{fieldName(v.c)}</span>
     <select aria-label="Summarise by" value={v.fn} onChange={e=>onChange({...p,vals:p.vals.map((y,k)=>k===j?{...y,fn:e.target.value as PivFn}:y)})}>{FNS.map(f=><option key={f} value={f}>{FN_LABEL[f]}</option>)}</select>
     <button type="button" className="zs2-ticon" aria-label="Remove" onClick={()=>onChange({...p,vals:p.vals.filter((_,k)=>k!==j)})}><X size={14}/></button></div>)}</section>
   <label className="zs2-side-opt"><input type="checkbox" checked={!p.noTot} onChange={e=>{const n={...p};if(e.target.checked)delete n.noTot;else n.noTot=1;onChange(n);}}/>Show grand totals</label>
   {!p.vals.length&&<p className="zs2-side-note">Pick the columns to group by under Rows (and Columns), then add a value to add up or count.</p>}
  </div>
 </aside>;
}
