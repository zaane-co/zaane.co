'use client';
import Dropdown from '@/components/ui/Dropdown';
import {useEffect,useState,useRef} from 'react';
import {useRouter} from 'next/navigation';
import Markdown from 'react-markdown';
import {ChevronDown,Copy,Download,ExternalLink,ImagePlus,Pencil,Plus,Search,Star,X,Upload,Trash2,UserPlus} from 'lucide-react';
import MediaPicker from '@/components/admin/MediaPicker';
import ProjectGallery from '@/components/admin/ProjectGallery';
import {uploadImage} from '@/components/admin/blog/shared';
import {collections,safeUrl,type Field} from '@/lib/cms';
import {Status,when} from '@/components/admin/ui';
type Row=Record<string,unknown>;
const primary=(r:Row)=>String(r.title||r.name||r.client_name||r.email||r.key||r.page_key||'Gallery image');
// Public page for a record, when it has one.
const publicHref=(c:string,r:Row)=>r.status&&r.status!=='published'?'':c==='projects'?`/projects/${r.slug}`:c==='testimonials'?'/testimonials':c==='team_members'?'/about':c==='jobs'?'/careers':c==='resources'?safeUrl(r.download_url):'';
const secondary=(r:Row)=>String(r.excerpt||r.subject||r.service_interested||r.slug||r.role||r.client_role||r.section_key||r.value||r.location||'');

export default function Manager({collection,rows,role,options,gallery={},openId}:{collection:string;rows:Row[];role:string;options:Record<string,{value:string;label:string}[]>;gallery?:Record<string,{id:string;image_url:string;order:number}[]>;openId?:string}){
 const spec=collections[collection],router=useRouter();
 // openId: deep link from the Contacts address book (/admin/contact_submissions?open=<id>).
 const startRow=openId?rows.find(r=>r.id===openId)??null:null;
 const [selected,setSelected]=useState<Row|null>(startRow),[values,setValues]=useState<Row>(()=>startRow?Object.fromEntries(collections[collection].fields.map(f=>[f.key,startRow[f.key]??''])) as Row:{}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[preview,setPreview]=useState(false),[deleting,setDeleting]=useState(false);
 const bodyRef=useRef<HTMLTextAreaElement>(null);
 const [pickFor,setPickFor]=useState<string|null>(null);
 const [added,setAdded]=useState<Record<string,{value:string;label:string}[]>>({}),[creating,setCreating]=useState<string|null>(null),[newName,setNewName]=useState('');
 const choices=(f:Field)=>{const list=[...(options[f.key]||[]),...(added[f.key]||[])],cur=String(values[f.key]??'');return cur&&!list.some(o=>o.value===cur)?[{value:cur,label:cur},...list]:list;};
 async function createOption(f:Field){
  const name=newName.trim().replace(/\s+/g,' ');if(!name)return;setBusy(true);setMessage('');
  try{const r=await fetch('/api/admin/project-categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',kind:f.key,name})});const d=await r.json();if(!r.ok&&!/already exists/.test(d.error||''))throw new Error(d.error);
   setAdded(a=>({...a,[f.key]:[...(a[f.key]||[]),{value:name,label:name}]}));setValues(v=>({...v,[f.key]:name}));setCreating(null);setNewName('');router.refresh();}
  catch(e){setMessage(e instanceof Error?e.message:'Could not add it.');}finally{setBusy(false);}
 }
 const close=()=>{setSelected(null);setDeleting(false);};
 useEffect(()=>{if(!selected)return;const h=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[selected]);
 const valuesOf=(row:Row)=>Object.fromEntries(spec.fields.map(f=>[f.key,Array.isArray(row[f.key])?(row[f.key] as string[]).join(', '):row[f.key]??(f.key==='author_name'?'Zaane Studio':f.type==='select'&&!f.taxonomy?(f.options?.[0]||''):f.key==='rating'?5:f.key==='order'?0:'')])) as Row;
 function edit(row:Row){setSelected(row);setValues(valuesOf(row));setMessage('');setDeleting(false);setPreview(false);}
 // Row actions (status, feature, duplicate, delete) save straight from the table.
 const [menu,setMenu]=useState<string|null>(null),[confirmDelete,setConfirmDelete]=useState<Row|null>(null),[working,setWorking]=useState<string|null>(null);
 async function quick(row:Row|null,action:'save'|'delete',patch:Row={},done='Saved.'){
  setWorking(String(row?.id??'new'));setMessage('');
  try{const r=await fetch(`/api/admin/${collection}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:row?.id,values:row?{...valuesOf(row),...patch}:patch})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage(done);router.refresh();return true;}
  catch(e){setMessage(e instanceof Error?e.message:'Could not save.');return false;}finally{setWorking(null);setMenu(null);}
 }
 const duplicate=(row:Row)=>{const v=valuesOf(row),tag=Math.random().toString(36).slice(2,6);if('title' in v)v.title=`${v.title} (copy)`;if('name' in v&&!('title' in v))v.name=`${v.name} (copy)`;if('slug' in v)v.slug=`${String(v.slug).slice(0,100)}-copy-${tag}`;if('status' in v)v.status='draft';if('featured' in v)v.featured=false;return quick(null,'save',v,'Duplicated as a draft.');};
 const statusField=spec.fields.find(f=>f.key==='status');
 const canDelete=role!=='editor'&&collection!=='users';
 const canDuplicate=!spec.inbox&&!['settings','pages_content','users'].includes(collection);
 const hasFeatured=spec.fields.some(f=>f.key==='featured');
 const [picked,setPicked]=useState<string[]>([]),[bulkDelete,setBulkDelete]=useState(false);
 const canBulk=canDelete||!!statusField?.options;
 async function bulk(action:'bulk_delete'|'bulk_status',status?:string){
  setWorking('bulk');setMessage('');
  try{const r=await fetch(`/api/admin/${collection}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,ids:picked,status})});const d=await r.json();if(!r.ok)throw new Error(d.error);
   setMessage(action==='bulk_delete'?`Deleted ${d.count??picked.length} record${(d.count??picked.length)===1?'':'s'}.`:`Updated ${d.count??picked.length} to ${status?.replace('_',' ')}.`);setPicked([]);setBulkDelete(false);router.refresh();}
  catch(e){setMessage(e instanceof Error?e.message:'Could not update.');}finally{setWorking(null);}
 }
 async function save(action:'save'|'delete'){
  setBusy(true);setMessage('');try{const r=await fetch(`/api/admin/${collection}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:selected?.id,values})});const data=await r.json();if(!r.ok)throw new Error(data.error);close();setMessage(action==='save'?'Saved successfully.':'Record deleted.');router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
 }
 async function upload(f:Field,file?:File){if(!file)return;setBusy(true);setMessage('Uploading…');try{const url=await uploadImage(file);setValues(v=>({...v,[f.key]:url}));setMessage('Image uploaded. Save the record to attach it.');}catch(e){setMessage(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}}
 function insert(before:string,after=''){const node=bodyRef.current;if(!node)return;const start=node.selectionStart,end=node.selectionEnd;const text=String(values.content||'');setValues(v=>({...v,content:text.slice(0,start)+before+text.slice(start,end)+after+text.slice(end)}));node.focus();}
 // Contact messages that turn into real work become CRM leads.
 async function convert(row:Row){
  setWorking(String(row.id));setMessage('');
  try{const r=await fetch('/api/admin/crm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'convert_contact',id:row.id})});const d=await r.json();if(!r.ok)throw new Error(d.error);router.push(`/admin/leads/${d.id}`);}
  catch(e){setMessage(e instanceof Error?e.message:'Could not convert.');setWorking(null);}
 }
 const shown=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
 const hasStatus=rows.some(r=>r.status)||spec.fields.some(f=>f.key==='status');
 const image=(r:Row)=>safeUrl(r.cover_image||r.image_url||r.photo_url);

 return <>
  <div className="za-toolbar">
   <div className="za-search za-search-wide"><Search size={14}/><input placeholder="Search this page…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search records"/></div>
   <div className="za-toolbar-actions">
    {['leads','contact_submissions','subscribers'].includes(collection)&&<a className="za-btn za-btn-ghost" href={`/api/admin/${collection}`}><Download size={15}/>Export CSV</a>}
    {(!spec.inbox||spec.creatable)&&<button className="za-btn za-btn-primary" onClick={()=>edit({})}><Plus size={15}/>New {spec.noun??spec.label.toLowerCase().replace(/s$/,'')}</button>}
   </div>
  </div>
  {collection==='users'&&<p className="za-notice">Create or invite an account in Supabase Authentication, then assign its staff role here. Unassigned accounts have no admin access.</p>}
  {message&&!selected&&<p role="status" className="za-flash">{message}</p>}
  {picked.length>0&&<div className="za-bulkbar" role="region" aria-label="Bulk actions">
   <strong>{picked.length} selected</strong>
   {statusField?.options&&<Dropdown variant="inline" label="Change status of selected" placeholder="Change status…" value="" disabled={working==='bulk'} onChange={x=>void bulk('bulk_status',x)} options={statusField.options.filter(o=>!(role==='editor'&&o==='published')).map(o=>({value:o,label:o.replace('_',' ')}))}/>}
   {canDelete&&<button type="button" className="za-btn za-btn-danger" disabled={working==='bulk'} onClick={()=>setBulkDelete(true)}><Trash2 size={14}/>Delete</button>}
   <button type="button" className="za-btn za-btn-ghost" onClick={()=>setPicked([])}>Clear</button>
  </div>}
  <section className="za-card">
   {shown.length?<div className="za-table-wrap"><table className="za-table za-table-click">
    <thead><tr>{canBulk&&<th className="za-th-check"><input type="checkbox" aria-label="Select all" data-tip={shown.every(r=>picked.includes(String(r.id)))?'Deselect all':'Select all'} checked={shown.length>0&&shown.every(r=>picked.includes(String(r.id)))} ref={el=>{if(el)el.indeterminate=picked.length>0&&!shown.every(r=>picked.includes(String(r.id)));}} onChange={e=>setPicked(e.target.checked?shown.map(r=>String(r.id)):[])}/></th>}<th>{spec.inbox?'From':'Title'}</th><th className="za-hide-sm">Details</th>{hasStatus&&<th>Status</th>}<th className="za-hide-sm">Created</th><th className="za-th-actions">Actions</th></tr></thead>
    <tbody>{shown.map(row=><tr key={String(row.id)} className={picked.includes(String(row.id))?'is-picked':''} onClick={()=>edit(row)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')edit(row);}}>
     {canBulk&&<td className="za-td-check" onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={`Select ${primary(row)}`} checked={picked.includes(String(row.id))} onChange={e=>setPicked(p=>e.target.checked?[...p,String(row.id)]:p.filter(x=>x!==String(row.id)))}/></td>}
     <td><div className="za-cell-main">{image(row)&&<img src={image(row)} alt="" className="za-thumb"/>}<span><b>{primary(row)}</b>{spec.inbox&&row.email&&primary(row)!==row.email?<small>{String(row.email)}</small>:null}</span></div></td>
     <td className="za-hide-sm za-cell-muted">{secondary(row)}</td>
     {hasStatus&&<td onClick={e=>e.stopPropagation()} className="za-status-cell">{statusField?.options&&!(role==='editor'&&row.status==='published')?<>
      <button type="button" className="za-status-btn" onClick={()=>setMenu(menu===row.id?null:String(row.id))} aria-haspopup="menu" aria-expanded={menu===row.id}><Status value={row.status as string}/><ChevronDown size={12}/></button>
      {menu===row.id&&<><button type="button" className="za-menu-scrim" aria-label="Close" onClick={()=>setMenu(null)}/><div className="za-status-menu" role="menu">{statusField.options.filter(o=>!(role==='editor'&&o==='published')).map(o=><button type="button" role="menuitem" key={o} disabled={working===row.id} className={o===row.status?'is-current':''} onClick={()=>o!==row.status&&quick(row,'save',{status:o},`Status changed to ${o.replace('_',' ')}.`)}><Status value={o}/></button>)}</div></>}
     </>:<Status value={row.status as string}/>}</td>}
     <td className="za-hide-sm za-cell-muted">{when(row.created_at as string)}</td>
     <td onClick={e=>e.stopPropagation()}><div className="za-row-actions">
      {hasFeatured&&role!=='editor'&&<button type="button" data-tip={row.featured?'Remove from homepage':'Feature on homepage'} aria-label="Toggle featured" disabled={working===row.id} className={row.featured?'is-featured':''} onClick={()=>quick(row,'save',{featured:!row.featured},row.featured?'Removed from featured.':'Featured on homepage.')}><Star size={14} fill={row.featured?'currentColor':'none'}/></button>}
      {publicHref(collection,row)&&<a href={publicHref(collection,row)} target="_blank" rel="noopener noreferrer" data-tip="View on site" aria-label="View on site"><ExternalLink size={14}/></a>}
      {collection==='contact_submissions'&&<button type="button" data-tip="Convert to lead" aria-label="Convert to lead" disabled={working===row.id} onClick={()=>void convert(row)}><UserPlus size={14}/></button>}
      {spec.fields.length>0&&<button type="button" data-tip="Edit" aria-label="Edit" onClick={()=>edit(row)}><Pencil size={14}/></button>}
      {canDuplicate&&<button type="button" data-tip="Duplicate" aria-label="Duplicate" disabled={working==='new'} onClick={()=>void duplicate(row)}><Copy size={14}/></button>}
      {canDelete&&<button type="button" data-tip="Delete" aria-label="Delete" className="za-row-danger" onClick={()=>setConfirmDelete(row)}><Trash2 size={14}/></button>}
     </div></td>
    </tr>)}</tbody>
   </table></div>:<div className="za-empty za-empty-lg"><h3>{search?'No matches':'Nothing here yet'}</h3><p>{search?'Try a different search.':spec.creatable?'Form messages land here, or add a contact yourself.':spec.inbox?'New submissions will appear here.':'Create your first record when you’re ready.'}</p></div>}
  </section>

  {selected&&<>
   <button className="za-drawer-scrim" aria-label="Close editor" onClick={close}/>
   <aside className="za-drawer" role="dialog" aria-label={selected.id?'Edit record':'New record'}>
    <div className="za-drawer-head"><div><p>{spec.label}</p><h2>{selected.id?primary(selected):`New ${spec.noun??'record'}`}</h2></div><button className="za-icon-btn" onClick={close} aria-label="Close" data-tip="Close"><X size={18}/></button></div>
    <form onSubmit={e=>{e.preventDefault();void save('save');}} className="za-drawer-body" data-lenis-prevent>
     {spec.inbox&&!!selected.id&&<dl className="za-details">{Object.entries(selected).filter(([k])=>!['id','status','role'].includes(k)&&!spec.fields.some(f=>f.key===k)).map(([k,v])=><div key={k} className={k==='message'?'za-details-wide':''}><dt>{k.replaceAll('_',' ')}</dt><dd>{k==='created_at'?when(String(v)):String(v??'-')||'-'}</dd></div>)}</dl>}
     {spec.fields.map(f=><div className="za-field" key={f.key}>
      <div className="za-field-label"><label htmlFor={`field-${f.key}`}>{f.label}{f.required?' *':''}</label>
       {f.type==='markdown'&&<div className="za-md-tools">{f.key==='content'&&<><button type="button" onClick={()=>insert('**','**')}>Bold</button><button type="button" onClick={()=>insert('## ')}>H2</button><button type="button" onClick={()=>insert('- ')}>List</button><button type="button" onClick={()=>insert('[','](https://)')}>Link</button></>}<button type="button" aria-pressed={preview} className={preview?'is-on':''} onClick={()=>setPreview(!preview)}>{preview?'Write':'Preview'}</button></div>}
      </div>
      {f.taxonomy?(creating===f.key?<div className="za-inline-create"><input id={`field-${f.key}`} autoFocus maxLength={80} placeholder={`New ${f.label.toLowerCase()}`} value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void createOption(f);}if(e.key==='Escape'){setCreating(null);setNewName('');}}}/><button type="button" className="za-btn za-btn-primary" disabled={busy||!newName.trim()} onClick={()=>void createOption(f)}>Add</button><button type="button" className="za-btn za-btn-ghost" onClick={()=>{setCreating(null);setNewName('');}}>Cancel</button></div>
       :<Dropdown id={`field-${f.key}`} label={f.label} value={String(values[f.key]??'')} onChange={x=>{if(x==='__new__'){setCreating(f.key);setNewName('');}else setValues({...values,[f.key]:x});}} options={[{value:'',label:f.required?`Select ${f.label.toLowerCase()}`:'None'},...choices(f),...(role!=='editor'?[{value:'__new__',label:'+ Create new…'}]:[])]}/>)
      :f.type==='select'?<Dropdown id={`field-${f.key}`} label={f.label} placeholder={`Select ${f.label.toLowerCase()}`} value={String(values[f.key]??'')} onChange={x=>setValues({...values,[f.key]:x})} options={[...(f.options?[]:[{value:'',label:`Select ${f.label.toLowerCase()}`}]),...(f.options?.map(v=>({value:v,label:v||'No staff access'}))||options[f.key]||[]).filter(o=>!(role==='editor'&&o.value==='published'))]}/>
      :f.type==='boolean'?<input id={`field-${f.key}`} type="checkbox" checked={!!values[f.key]} onChange={e=>setValues({...values,[f.key]:e.target.checked})}/>
      :f.type==='textarea'||f.type==='markdown'?(preview&&f.type==='markdown'?<div className="prose za-md-preview"><Markdown>{String(values[f.key]||'Nothing to preview yet.')}</Markdown></div>:<textarea ref={f.key==='content'?bodyRef:undefined} id={`field-${f.key}`} rows={f.type==='markdown'?14:4} required={f.required} value={String(values[f.key]||'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>)
      :<input id={`field-${f.key}`} type={f.type==='number'?'number':'text'} required={f.required} value={String(values[f.key]??'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>}
      {f.type==='image'&&<div className="za-upload">{safeUrl(values[f.key])&&<img src={safeUrl(values[f.key])} alt="Selected image preview"/>}<label className="za-btn za-btn-ghost"><Upload size={15}/>Upload image<input type="file" accept="image/*" disabled={busy} onChange={e=>void upload(f,e.target.files?.[0])} hidden/></label><button type="button" className="za-btn za-btn-ghost" onClick={()=>setPickFor(f.key)}><ImagePlus size={15}/>Choose from library</button></div>}
     </div>)}
     {collection==='projects'&&(selected.id?<ProjectGallery key={String(selected.id)} projectId={String(selected.id)} initial={gallery[String(selected.id)]??[]}/>:<div className="za-field"><div className="za-field-label"><label>Gallery</label></div><p className="za-notice">Save the project first, then reopen it to add gallery images.</p></div>)}
     {message&&<p role="status" className="za-flash">{message}</p>}
     <div className="za-drawer-foot">
      {!!selected.id&&role!=='editor'&&collection!=='users'&&(deleting?<div className="za-confirm"><span>Delete permanently?</span><button disabled={busy} type="button" className="za-btn za-btn-danger" onClick={()=>void save('delete')}>Yes, delete</button><button type="button" className="za-btn za-btn-ghost" onClick={()=>setDeleting(false)}>Cancel</button></div>:<button type="button" className="za-btn za-btn-ghost za-btn-danger-text" onClick={()=>setDeleting(true)}><Trash2 size={15}/>Delete</button>)}
      {collection==='contact_submissions'&&!!selected.id&&!deleting&&<button type="button" className="za-btn za-btn-ghost" disabled={working===selected.id} onClick={()=>void convert(selected)}><UserPlus size={15}/>Convert to lead</button>}
      {!!spec.fields.length&&!deleting&&<button disabled={busy} className="za-btn za-btn-primary za-push">{busy?'Working…':'Save changes'}</button>}
     </div>
    </form>
   </aside>
  </>}
  {bulkDelete&&<div className="za-modal-scrim" onClick={()=>setBulkDelete(false)}>
   <div className="za-modal" role="alertdialog" aria-label="Delete selected" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete {picked.length} record{picked.length===1?'':'s'}?</strong><small>{spec.label}</small></div></div>
    <p>This permanently deletes everything you selected and can’t be undone.</p>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setBulkDelete(false)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={working==='bulk'} onClick={()=>void bulk('bulk_delete')}>{working==='bulk'?'Deleting…':`Delete ${picked.length}`}</button></div>
   </div>
  </div>}
  {confirmDelete&&<div className="za-modal-scrim" onClick={()=>setConfirmDelete(null)}>
   <div className="za-modal" role="alertdialog" aria-label="Delete record" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete {spec.label.toLowerCase().replace(/s$/,'')}?</strong><small>{primary(confirmDelete)}</small></div></div>
    <p>This permanently deletes it and can’t be undone.</p>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setConfirmDelete(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={working===confirmDelete.id} onClick={async()=>{if(await quick(confirmDelete,'delete',{},'Record deleted.'))setConfirmDelete(null);}}>{working===confirmDelete.id?'Deleting…':'Delete'}</button></div>
   </div>
  </div>}
  <MediaPicker open={!!pickFor} onClose={()=>setPickFor(null)} onPick={([url])=>{if(pickFor&&url){setValues(v=>({...v,[pickFor]:url}));setMessage('Image selected. Save the record to attach it.');}}}/>
 </>;
}
