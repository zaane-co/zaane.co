'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,Copy,Eye,EyeOff,ExternalLink,KeyRound,Pencil,Plus,RefreshCw,ShieldCheck,Trash2} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';
import {dayOf,timeOf} from './format';
type Item={id:string;label:string;url:string;username:string;note:string;has_secret:boolean;created_by:string|null;updated_at:string};
type Log={id:string;item_label:string;user_id:string|null;action:string;at:string};
const api=async(body:object)=>{const r=await fetch('/api/zarn/vault',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;};
const strong=()=>{const set='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';const a=crypto.getRandomValues(new Uint32Array(20));return Array.from(a,n=>set[n%set.length]).join('');};
const verb:Record<string,string>={create:'added',update:'changed',delete:'deleted',reveal:'viewed the password of',copy:'copied the password of'};
// Logins for a client, kept encrypted. Passwords stay hidden until someone chooses to reveal or copy them, and that is logged.
export default function ClientVault({leadId}:{leadId:string}){
 const {me,people}=useZarn(),confirm=useConfirm();
 const [items,setItems]=useState<Item[]|null>(null),[admin,setAdmin]=useState(false),[err,setErr]=useState(''),[editing,setEditing]=useState<Item|'new'|null>(null),[log,setLog]=useState<Log[]|null>(null);
 const [shown,setShown]=useState<{id:string;secret:string}|null>(null),[copied,setCopied]=useState('');
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const load=useCallback(async()=>{
  try{const d=await api({action:'list',lead_id:leadId});setItems(d.items);setAdmin(!!d.admin);setErr('');if(d.admin){try{setLog((await api({action:'log',lead_id:leadId})).log);}catch{}}}
  catch(e){setErr(e instanceof Error?e.message:'Could not load the vault.');setItems([]);}
 },[leadId]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load();return()=>{if(timer.current)clearTimeout(timer.current);};},[load]);
 const hide=()=>{setShown(null);if(timer.current)clearTimeout(timer.current);};
 async function reveal(i:Item){
  if(shown?.id===i.id){hide();return;}
  try{const d=await api({action:'reveal',id:i.id,purpose:'view'});setShown({id:i.id,secret:d.secret});if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setShown(null),12000);void load();}
  catch(e){setErr(e instanceof Error?e.message:'Could not reveal it.');}
 }
 async function copy(i:Item,what:'secret'|'user'){
  try{
   const text=what==='user'?i.username:(await api({action:'reveal',id:i.id,purpose:'copy'})).secret;
   await navigator.clipboard.writeText(text);setCopied(`${i.id}:${what}`);setTimeout(()=>setCopied(''),1500);
   if(what==='secret')void load();
  }catch(e){setErr(e instanceof Error?e.message:'Could not copy.');}
 }
 async function remove(i:Item){
  if(!await confirm({title:`Delete “${i.label}”?`,message:'The saved login is deleted for everyone on this client. This can’t be undone.',confirm:'Delete login',danger:true}))return;
  try{await api({action:'delete',id:i.id});setItems(x=>(x??[]).filter(y=>y.id!==i.id));void load();}catch(e){setErr(e instanceof Error?e.message:'Could not delete it.');}
 }
 return <div className="zn-pane"><div className="zn-pane-inner">
  <div className="zn-card-head"><h3><KeyRound size={15}/> Vault</h3><button type="button" className="zn-btn is-primary" onClick={()=>setEditing('new')}><Plus size={14}/>Add login</button></div>
  <p className="zv-note"><ShieldCheck size={14}/>Passwords are encrypted before they are saved and stay hidden until you reveal or copy them. Only this client’s team and admins can open the vault, and every reveal is logged. Don’t put passwords in chat or tasks.</p>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  {items===null?<p className="zn-loading">Loading…</p>:items.length?<ul className="zv-list">{items.map(i=><li key={i.id} className="zv-item">
   <div className="zv-head"><b>{i.label}</b>{i.url&&<a href={/^https?:\/\//i.test(i.url)?i.url:`https://${i.url}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${i.label}`}><ExternalLink size={13}/>{i.url.replace(/^https?:\/\//i,'').replace(/\/$/,'')}</a>}
    <span className="zv-actions">{(i.created_by===me.user_id||admin)&&<><button type="button" aria-label="Edit" data-tip="Edit" onClick={()=>setEditing(i)}><Pencil size={14}/></button><button type="button" aria-label="Delete" data-tip="Delete" className="is-danger" onClick={()=>void remove(i)}><Trash2 size={14}/></button></>}</span></div>
   <div className="zv-rows">
    {i.username&&<div className="zv-row"><small>Username</small><span>{i.username}</span><button type="button" aria-label="Copy username" onClick={()=>void copy(i,'user')}>{copied===`${i.id}:user`?<Check size={14}/>:<Copy size={14}/>}</button></div>}
    {i.has_secret&&<div className="zv-row"><small>Password</small><span className="zv-secret">{shown?.id===i.id?shown.secret:'••••••••••••'}</span>
     <button type="button" aria-label={shown?.id===i.id?'Hide password':'Reveal password'} onClick={()=>void reveal(i)}>{shown?.id===i.id?<EyeOff size={14}/>:<Eye size={14}/>}</button>
     <button type="button" aria-label="Copy password" onClick={()=>void copy(i,'secret')}>{copied===`${i.id}:secret`?<Check size={14}/>:<Copy size={14}/>}</button></div>}
    {i.note&&<div className="zv-row is-note"><small>Note</small><span>{i.note}</span></div>}
   </div></li>)}</ul>
   :<div className="zn-empty-state"><KeyRound size={26}/><h2>No logins saved</h2><p>Keep this client’s website, hosting and email logins here instead of in tasks or chat.</p></div>}
  {admin&&log&&log.length>0&&<section className="zv-log"><h4>Recent activity</h4><ul>{log.map(l=><li key={l.id}><b>{l.user_id===me.user_id?'You':people[l.user_id??'']?.display_name??'Someone'}</b> {verb[l.action]??l.action} <i>{l.item_label}</i><time>{dayOf(l.at)} {timeOf(l.at)}</time></li>)}</ul></section>}
  {editing&&<VaultForm leadId={leadId} item={editing==='new'?null:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);void load();}}/>}
 </div></div>;
}
function VaultForm({leadId,item,onClose,onSaved}:{leadId:string;item:Item|null;onClose:()=>void;onSaved:()=>void}){
 const [label,setLabel]=useState(item?.label??''),[url,setUrl]=useState(item?.url??''),[username,setUsername]=useState(item?.username??''),[secret,setSecret]=useState(''),[note,setNote]=useState(item?.note??''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   if(item)await api({action:'update',id:item.id,label,url,username,note,...(secret?{secret}:{})});
   else await api({action:'create',lead_id:leadId,label,url,username,note,secret});
   onSaved();
  }catch(err){setError(err instanceof Error?err.message:'Could not save.');setBusy(false);}
 }
 return <Modal title={item?'Edit login':'Add a login'} onClose={onClose}><form className="zn-modal-body" onSubmit={save} autoComplete="off">
  <label className="zn-label">Name<input className="zn-input" autoFocus required maxLength={120} value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Hosting, Website admin, Church email"/></label>
  <label className="zn-label">Website (optional)<input className="zn-input" maxLength={500} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></label>
  <label className="zn-label">Username or email<input className="zn-input" maxLength={300} autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)}/></label>
  <div className="zn-label">Password{item?.has_secret&&<small> (leave empty to keep the current one)</small>}
   <div className="zv-pass"><input className="zn-input" type={show?'text':'password'} autoComplete="new-password" maxLength={500} value={secret} onChange={e=>setSecret(e.target.value)}/>
    <button type="button" className="zn-btn" onClick={()=>setShow(v=>!v)} aria-label={show?'Hide':'Show'}>{show?<EyeOff size={14}/>:<Eye size={14}/>}</button>
    <button type="button" className="zn-btn" onClick={()=>{setSecret(strong());setShow(true);}} data-tip="Generate a strong password"><RefreshCw size={14}/></button></div></div>
  <label className="zn-label">Note (optional)<textarea className="zn-input" rows={2} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Security questions, recovery email, who has 2-step access…"/></label>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!label.trim()}>{busy?'Saving…':'Save login'}</button></div>
 </form></Modal>;
}
