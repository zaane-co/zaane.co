'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,ImageIcon,Loader2,X} from 'lucide-react';
import MediaPicker from './MediaPicker';
import {settingGroups,settingKeys,type SettingField} from '@/lib/site-settings';

// The Settings page: every site-wide value in grouped cards, saved together from one bar.
export default function SiteSettings({initial}:{initial:Record<string,string>}){
 const router=useRouter();
 const [saved,setSaved]=useState(initial),[values,setValues]=useState(initial);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[bad,setBad]=useState(''),[done,setDone]=useState(false);
 const [picking,setPicking]=useState<string|null>(null);
 const dirty=settingKeys.filter(f=>(values[f.key]??'')!==(saved[f.key]??''));
 const set=(key:string,v:string)=>{setValues(s=>({...s,[key]:v}));setDone(false);if(bad===key){setBad('');setError('');}};

 async function save(){
  setBusy(true);setError('');setBad('');
  const patch=Object.fromEntries(dirty.map(f=>[f.key,values[f.key]??'']));
  const res=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:patch})}).catch(()=>null);
  const d=await res?.json().catch(()=>null);
  setBusy(false);
  if(!res?.ok){setError(d?.error||'Could not save settings.');setBad(d?.field||'');return;}
  const next=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v.trim()]).filter(([,v])=>v));
  setSaved(next);setValues(next);setDone(true);router.refresh();
 }

 const field=(f:SettingField)=>{
  const v=values[f.key]??'',id=`set-${f.key}`;
  return <div className={`za-field za-set-field${bad===f.key?' is-bad':''}`} key={f.key}>
   <div className="za-field-label"><label htmlFor={id}>{f.label}</label></div>
   {f.type==='image'?<div className="za-set-image">
     <div className="za-set-thumb">{v?<img src={v} alt=""/>:<ImageIcon size={20}/>}</div>
     <div className="za-set-image-body">
      <span>{v?v.split('/').pop():'Using the default photo'}</span>
      <div><button type="button" className="za-btn za-btn-ghost" onClick={()=>setPicking(f.key)}>{v?'Replace':'Choose image'}</button>{v&&<button type="button" className="za-btn za-btn-ghost" onClick={()=>set(f.key,'')}><X size={14}/>Remove</button>}</div>
     </div>
    </div>
   :f.type==='textarea'?<textarea id={id} rows={f.key==='site_description'?2:3} value={v} placeholder={f.placeholder} onChange={e=>set(f.key,e.target.value)}/>
   :<input id={id} type={f.type} value={v} placeholder={f.placeholder} onChange={e=>set(f.key,e.target.value)}/>}
   {f.key==='site_description'&&v.length>0?<p className="za-set-hint">{v.length} / 160 characters</p>:f.hint&&<p className="za-set-hint">{f.hint}</p>}
  </div>;
 };

 return <div className="za-settings">
  <nav className="za-set-nav" aria-label="Settings sections">{settingGroups.map(g=><a key={g.id} href={`#${g.id}`}>{g.title}</a>)}</nav>
  <div className="za-set-groups">
   {settingGroups.map(g=><section className="za-card za-set-group" id={g.id} key={g.id}>
    <header><h2>{g.title}</h2><p>{g.summary}</p></header>
    <div className="za-set-fields">{g.fields.map(field)}</div>
   </section>)}
  </div>
  {(dirty.length>0||error||done)&&<div className="za-set-bar" role="status">
   <span>{error?<b className="za-set-error">{error}</b>:done&&!dirty.length?<><Check size={15}/>Saved. Changes are live on zaane.co.</>:`${dirty.length} unsaved change${dirty.length===1?'':'s'}`}</span>
   {dirty.length>0&&<div><button type="button" className="za-btn za-btn-ghost" disabled={busy} onClick={()=>{setValues(saved);setError('');setBad('');}}>Discard</button><button type="button" className="za-btn za-btn-primary" disabled={busy} onClick={save}>{busy&&<Loader2 size={15} className="za-spin"/>}Save changes</button></div>}
   {done&&!dirty.length&&<button type="button" className="za-icon-btn" aria-label="Dismiss" onClick={()=>setDone(false)}><X size={15}/></button>}
  </div>}
  <MediaPicker open={!!picking} onClose={()=>setPicking(null)} onPick={([url])=>{if(picking&&url)set(picking,url);}}/>
 </div>;
}
