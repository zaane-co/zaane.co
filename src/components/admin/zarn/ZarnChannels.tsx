'use client';
import Flash from '../Flash';
import Dropdown from '@/components/ui/Dropdown';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Archive,ArchiveRestore,Hash,Lock,Pencil,Plus,Trash2,Users,X} from 'lucide-react';
import {zarnApi,type ZChannel} from '@/lib/zarn';
import {F} from '../crm/NewLead';

export type ChannelRow=ZChannel&{member_ids:string[];messages:number};
type Person={user_id:string;display_name:string;email:string};
const feedLabel={leads:'New leads + stage changes',invoices:'Invoices sent + paid'} as const;
// ZARN channels: create, rename, set topic/default/CRM feed, manage members, archive, delete.
export default function ZarnChannels({rows,members}:{rows:ChannelRow[];members:Person[]}){
 const router=useRouter();
 const [edit,setEdit]=useState<ChannelRow|'new'|null>(null),[people,setPeople]=useState<ChannelRow|null>(null),[removing,setRemoving]=useState<ChannelRow|null>(null);
 const [busy,setBusy]=useState(false),[flash,setFlash]=useState(''),[error,setError]=useState('');
 const blank={name:'',kind:'public' as 'public'|'private',topic:'',is_default:false,crm_feed:'' as ''|'leads'|'invoices'};
 const [v,setV]=useState(blank),[sel,setSel]=useState<string[]>([]);
 async function run(body:object,msg:string){setBusy(true);setError('');try{const r=await zarnApi('/api/zarn/admin',body);setFlash(msg);router.refresh();return r;}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');setFlash(e instanceof Error?e.message:'');return null;}finally{setBusy(false);}}
 const open=(c:ChannelRow|'new')=>{setEdit(c);setError('');setV(c==='new'?blank:{name:c.name??'',kind:c.kind as 'public'|'private',topic:c.topic,is_default:c.is_default,crm_feed:(c.crm_feed??'') as ''|'leads'|'invoices'});};
 async function save(e:React.FormEvent){
  e.preventDefault();const feed=v.crm_feed||null;
  const ok=edit==='new'?await run({action:'channel_create',name:v.name,kind:v.kind,topic:v.topic,is_default:v.is_default,crm_feed:feed},`#${v.name} created.`)
   :await run({action:'channel_update',id:(edit as ChannelRow).id,name:v.name,topic:v.topic,is_default:v.is_default,crm_feed:feed},'Channel updated.');
  if(ok)setEdit(null);
 }
 const active=rows.filter(r=>!r.archived_at),archived=rows.filter(r=>r.archived_at);
 const table=(list:ChannelRow[])=><div className="za-table-wrap"><table className="za-table"><thead><tr><th>Channel</th><th className="za-hide-sm">Members</th><th className="za-hide-sm">Messages</th><th className="za-hide-sm">Settings</th><th className="za-th-actions"><span className="sr-only">Actions</span></th></tr></thead><tbody>{list.map(c=><tr key={c.id}>
  <td><div className="za-cell-main"><span className="za-crm-avatar" style={{background:c.kind==='private'?'#52525b':'var(--accent)'}}>{c.kind==='private'?<Lock size={14}/>:<Hash size={15}/>}</span><span><b>{c.name}</b><small>{c.topic||'No topic'}</small></span></div></td>
  <td className="za-hide-sm">{c.member_ids.length}</td><td className="za-hide-sm">{c.messages}</td>
  <td className="za-hide-sm"><div className="za-tags">{c.is_default&&<span className="is-cat">Auto-join</span>}{c.crm_feed&&<span>CRM: {feedLabel[c.crm_feed as 'leads'|'invoices']}</span>}{c.kind==='private'&&<span>Private</span>}</div></td>
  <td><div className="za-row-actions">
   <button type="button" data-tip="Members" aria-label="Members" onClick={()=>{setPeople(c);setSel(c.member_ids);}}><Users size={14}/></button>
   <button type="button" data-tip="Edit" aria-label="Edit" onClick={()=>open(c)}><Pencil size={14}/></button>
   <button type="button" data-tip={c.archived_at?'Unarchive':'Archive'} aria-label={c.archived_at?'Unarchive':'Archive'} disabled={busy} onClick={()=>void run({action:'channel_archive',id:c.id,archived:!c.archived_at},c.archived_at?`#${c.name} restored.`:`#${c.name} archived.`)}>{c.archived_at?<ArchiveRestore size={14}/>:<Archive size={14}/>}</button>
   <button type="button" className="za-row-danger" data-tip="Delete" aria-label="Delete" onClick={()=>setRemoving(c)}><Trash2 size={14}/></button>
  </div></td></tr>)}</tbody></table></div>;
 return <div className="za-page">
  <div className="za-page-head"><div><h1>ZARN channels</h1><p>Set up channels, who’s in them, and where CRM updates post.</p></div><button type="button" className="za-btn za-btn-primary" onClick={()=>open('new')}><Plus size={15}/>New channel</button></div>
  {flash&&<Flash>{flash}</Flash>}
  <section className="za-card">{active.length?table(active):<p className="za-empty">No channels yet.</p>}</section>
  {archived.length>0&&<section className="za-card"><div className="za-card-head"><h2>Archived</h2></div>{table(archived)}</section>}

  {edit&&<div className="za-modal-scrim" onClick={()=>setEdit(null)}><form className="za-modal za-modal-wide" role="dialog" aria-label="Channel" onClick={e=>e.stopPropagation()} onSubmit={save}>
   <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand"><Hash size={18}/></span><div><strong>{edit==='new'?'New channel':`Edit #${edit.name}`}</strong><small>Lowercase, numbers, dashes</small></div><button type="button" className="za-icon-btn za-push" aria-label="Close" onClick={()=>setEdit(null)}><X size={16}/></button></div>
   <div className="za-form-grid">
    <F label="Name *" wide><input required maxLength={80} value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></F>
    {edit==='new'&&<F label="Visibility"><Dropdown label="Visibility" value={v.kind} onChange={x=>setV({...v,kind:x as 'public'|'private',is_default:x==='private'?false:v.is_default})} options={[{value:'public',label:'Public',hint:'Any member can find and join'},{value:'private',label:'Private',hint:'Invite only'}]}/></F>}
    <F label="CRM updates" wide={edit!=='new'}><Dropdown label="CRM updates" value={v.crm_feed} onChange={x=>setV({...v,crm_feed:x as ''|'leads'|'invoices'})} options={[{value:'',label:'None'},{value:'leads',label:feedLabel.leads},{value:'invoices',label:feedLabel.invoices}]}/></F>
    <F label="Topic" wide><input maxLength={250} value={v.topic} onChange={e=>setV({...v,topic:e.target.value})}/></F>
   </div>
   {v.kind==='public'&&<label className="za-check-row"><input type="checkbox" checked={v.is_default} onChange={e=>setV({...v,is_default:e.target.checked})}/>Everyone joins automatically (new members too)</label>}
   {error&&<Flash tone="error">{error}</Flash>}
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setEdit(null)}>Cancel</button><button className="za-btn za-btn-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
  </form></div>}
  {people&&<div className="za-modal-scrim" onClick={()=>setPeople(null)}><div className="za-modal za-modal-wide" role="dialog" aria-label="Channel members" onClick={e=>e.stopPropagation()}>
   <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand"><Users size={18}/></span><div><strong>#{people.name} members</strong><small>{sel.length} selected</small></div><button type="button" className="za-icon-btn za-push" aria-label="Close" onClick={()=>setPeople(null)}><X size={16}/></button></div>
   <div className="za-zarn-pick">{members.map(m=><label key={m.user_id} className="za-check-row"><input type="checkbox" checked={sel.includes(m.user_id)} onChange={e=>setSel(s=>e.target.checked?[...s,m.user_id]:s.filter(x=>x!==m.user_id))}/><span><b>{m.display_name}</b><small>{m.email}</small></span></label>)}</div>
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setPeople(null)}>Cancel</button><button type="button" className="za-btn za-btn-primary" disabled={busy} onClick={async()=>{const add=sel.filter(x=>!people.member_ids.includes(x)),remove=people.member_ids.filter(x=>!sel.includes(x));if(await run({action:'channel_members',id:people.id,add,remove},'Members updated.'))setPeople(null);}}>Save</button></div>
  </div></div>}
  {removing&&<div className="za-modal-scrim" onClick={()=>setRemoving(null)}><div className="za-modal" role="alertdialog" aria-label="Delete channel" onClick={e=>e.stopPropagation()}>
   <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete #{removing.name}?</strong><small>{removing.messages} messages</small></div></div>
   <p>This deletes the channel and every message in it. To keep the history, archive it instead.</p>
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={busy} onClick={async()=>{await run({action:'channel_delete',id:removing.id},`#${removing.name} deleted.`);setRemoving(null);}}>Delete</button></div>
  </div></div>}
 </div>;
}
