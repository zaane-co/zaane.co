'use client';
import {useEffect,useState,useRef} from 'react';
import {useRouter} from 'next/navigation';
import Markdown from 'react-markdown';
import {Download,Plus,Search,X,Upload,Trash2} from 'lucide-react';
import {collections,safeUrl,type Field} from '@/lib/cms';
import {Status,when} from '@/components/admin/ui';
type Row=Record<string,unknown>;
const primary=(r:Row)=>String(r.title||r.name||r.client_name||r.email||r.key||r.page_key||'Gallery image');
const secondary=(r:Row)=>String(r.excerpt||r.subject||r.service_interested||r.slug||r.role||r.client_role||r.section_key||r.value||r.location||'');

export default function Manager({collection,rows,role,options}:{collection:string;rows:Row[];role:string;options:Record<string,{value:string;label:string}[]>}){
 const spec=collections[collection],router=useRouter();
 const [selected,setSelected]=useState<Row|null>(null),[values,setValues]=useState<Row>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[preview,setPreview]=useState(false),[deleting,setDeleting]=useState(false);
 const bodyRef=useRef<HTMLTextAreaElement>(null);
 const close=()=>{setSelected(null);setDeleting(false);};
 useEffect(()=>{if(!selected)return;const h=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[selected]);
 function edit(row:Row){setSelected(row);setValues(Object.fromEntries(spec.fields.map(f=>[f.key,Array.isArray(row[f.key])?(row[f.key] as string[]).join(', '):row[f.key]??(f.key==='author_name'?'Zaane Studio':f.type==='select'?(f.options?.[0]||''):f.key==='rating'?5:f.key==='order'?0:'')])));setMessage('');setDeleting(false);setPreview(false);}
 async function save(action:'save'|'delete'){
  setBusy(true);setMessage('');try{const r=await fetch(`/api/admin/${collection}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:selected?.id,values})});const data=await r.json();if(!r.ok)throw new Error(data.error);close();setMessage(action==='save'?'Saved successfully.':'Record deleted.');router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
 }
 async function upload(f:Field,file?:File){if(!file)return;setBusy(true);setMessage('Uploading…');try{const data=new FormData();data.set('file',file);const r=await fetch('/api/admin/upload',{method:'POST',body:data});const result=await r.json();if(!r.ok)throw new Error(result.error);setValues(v=>({...v,[f.key]:result.url}));setMessage('Image uploaded. Save the record to attach it.');}catch(e){setMessage(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}}
 function insert(before:string,after=''){const node=bodyRef.current;if(!node)return;const start=node.selectionStart,end=node.selectionEnd;const text=String(values.content||'');setValues(v=>({...v,content:text.slice(0,start)+before+text.slice(start,end)+after+text.slice(end)}));node.focus();}
 const shown=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
 const hasStatus=rows.some(r=>r.status)||spec.fields.some(f=>f.key==='status');
 const image=(r:Row)=>safeUrl(r.cover_image||r.image_url||r.photo_url);

 return <>
  <div className="za-toolbar">
   <div className="za-search za-search-wide"><Search size={14}/><input placeholder="Search this page…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search records"/></div>
   <div className="za-toolbar-actions">
    {['leads','contact_submissions','subscribers'].includes(collection)&&<a className="za-btn za-btn-ghost" href={`/api/admin/${collection}`}><Download size={15}/>Export CSV</a>}
    {!spec.inbox&&<button className="za-btn za-btn-primary" onClick={()=>edit({})}><Plus size={15}/>New {spec.label.toLowerCase().replace(/s$/,'')}</button>}
   </div>
  </div>
  {collection==='users'&&<p className="za-notice">Create or invite an account in Supabase Authentication, then assign its staff role here. Unassigned accounts have no admin access.</p>}
  {message&&!selected&&<p role="status" className="za-flash">{message}</p>}
  <section className="za-card">
   {shown.length?<div className="za-table-wrap"><table className="za-table za-table-click">
    <thead><tr><th>{spec.inbox?'From':'Title'}</th><th className="za-hide-sm">Details</th>{hasStatus&&<th>Status</th>}<th className="za-hide-sm">Created</th></tr></thead>
    <tbody>{shown.map(row=><tr key={String(row.id)} onClick={()=>edit(row)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')edit(row);}}>
     <td><div className="za-cell-main">{image(row)&&<img src={image(row)} alt="" className="za-thumb"/>}<span><b>{primary(row)}</b>{spec.inbox&&row.email&&primary(row)!==row.email?<small>{String(row.email)}</small>:null}</span></div></td>
     <td className="za-hide-sm za-cell-muted">{secondary(row)}</td>
     {hasStatus&&<td><Status value={row.status as string}/></td>}
     <td className="za-hide-sm za-cell-muted">{when(row.created_at as string)}</td>
    </tr>)}</tbody>
   </table></div>:<div className="za-empty za-empty-lg"><h3>{search?'No matches':'Nothing here yet'}</h3><p>{search?'Try a different search.':spec.inbox?'New submissions will appear here.':'Create your first record when you’re ready.'}</p></div>}
  </section>

  {selected&&<>
   <button className="za-drawer-scrim" aria-label="Close editor" onClick={close}/>
   <aside className="za-drawer" role="dialog" aria-label={selected.id?'Edit record':'New record'}>
    <div className="za-drawer-head"><div><p>{spec.label}</p><h2>{selected.id?primary(selected):'New record'}</h2></div><button className="za-icon-btn" onClick={close} aria-label="Close"><X size={18}/></button></div>
    <form onSubmit={e=>{e.preventDefault();void save('save');}} className="za-drawer-body" data-lenis-prevent>
     {spec.inbox&&<dl className="za-details">{Object.entries(selected).filter(([k])=>!['id','status','role'].includes(k)).map(([k,v])=><div key={k} className={k==='message'?'za-details-wide':''}><dt>{k.replaceAll('_',' ')}</dt><dd>{k==='created_at'?when(String(v)):String(v??'-')||'-'}</dd></div>)}</dl>}
     {spec.fields.map(f=><div className="za-field" key={f.key}>
      <div className="za-field-label"><label htmlFor={`field-${f.key}`}>{f.label}{f.required?' *':''}</label>
       {f.type==='markdown'&&<div className="za-md-tools">{f.key==='content'&&<><button type="button" onClick={()=>insert('**','**')}>Bold</button><button type="button" onClick={()=>insert('## ')}>H2</button><button type="button" onClick={()=>insert('- ')}>List</button><button type="button" onClick={()=>insert('[','](https://)')}>Link</button></>}<button type="button" aria-pressed={preview} className={preview?'is-on':''} onClick={()=>setPreview(!preview)}>{preview?'Write':'Preview'}</button></div>}
      </div>
      {f.type==='select'?<select id={`field-${f.key}`} required={f.required} value={String(values[f.key]??'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}>{!f.options&&<option value="">Select {f.label.toLowerCase()}</option>}{(f.options?.map(v=>({value:v,label:v||'No staff access'}))||options[f.key]||[]).filter(o=>!(role==='editor'&&o.value==='published')).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
      :f.type==='boolean'?<input id={`field-${f.key}`} type="checkbox" checked={!!values[f.key]} onChange={e=>setValues({...values,[f.key]:e.target.checked})}/>
      :f.type==='textarea'||f.type==='markdown'?(preview&&f.type==='markdown'?<div className="prose za-md-preview"><Markdown>{String(values[f.key]||'Nothing to preview yet.')}</Markdown></div>:<textarea ref={f.key==='content'?bodyRef:undefined} id={`field-${f.key}`} rows={f.type==='markdown'?14:4} required={f.required} value={String(values[f.key]||'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>)
      :<input id={`field-${f.key}`} type={f.type==='number'?'number':'text'} required={f.required} value={String(values[f.key]??'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>}
      {f.type==='image'&&<div className="za-upload">{safeUrl(values[f.key])&&<img src={safeUrl(values[f.key])} alt="Selected image preview"/>}<label className="za-btn za-btn-ghost"><Upload size={15}/>Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={e=>void upload(f,e.target.files?.[0])} hidden/></label></div>}
     </div>)}
     {message&&<p role="status" className="za-flash">{message}</p>}
     <div className="za-drawer-foot">
      {!!selected.id&&role!=='editor'&&collection!=='users'&&(deleting?<div className="za-confirm"><span>Delete permanently?</span><button disabled={busy} type="button" className="za-btn za-btn-danger" onClick={()=>void save('delete')}>Yes, delete</button><button type="button" className="za-btn za-btn-ghost" onClick={()=>setDeleting(false)}>Cancel</button></div>:<button type="button" className="za-btn za-btn-ghost za-btn-danger-text" onClick={()=>setDeleting(true)}><Trash2 size={15}/>Delete</button>)}
      {!!spec.fields.length&&!deleting&&<button disabled={busy} className="za-btn za-btn-primary za-push">{busy?'Working…':'Save changes'}</button>}
     </div>
    </form>
   </aside>
  </>}
 </>;
}
