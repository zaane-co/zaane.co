'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Braces,Check,Copy,Download,Eye,EyeOff,ExternalLink,FileText,KeyRound,Link2,Pencil,Plus,RefreshCw,Send,ShieldCheck,Terminal,Trash2} from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';
import {dayOf,timeOf} from './format';
type Kind='login'|'api'|'env'|'file';
type Item={id:string;kind:Kind;file_name:string;file_size:number;label:string;url:string;username:string;note:string;has_secret:boolean;created_by:string|null;updated_at:string};
type Log={id:string;item_label:string;user_id:string|null;action:string;at:string};
const api=async(body:object)=>{const r=await fetch('/api/zarn/vault',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;};
const strong=()=>{const set='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';const a=crypto.getRandomValues(new Uint32Array(20));return Array.from(a,n=>set[n%set.length]).join('');};
const verb:Record<string,string>={create:'added',update:'changed',delete:'deleted',reveal:'viewed',copy:'copied',download:'downloaded',share_create:'made a client link for',share_revoke:'turned off the client link',share_open:'opened the link',share_reveal:'viewed',share_download:'downloaded'};
const kindMeta:Record<Kind,{label:string;icon:React.ReactNode}>={login:{label:'Login',icon:<KeyRound size={14}/>},api:{label:'API key',icon:<Braces size={14}/>},env:{label:'Env settings',icon:<Terminal size={14}/>},file:{label:'Secret file',icon:<FileText size={14}/>}};
// Logins for a client, kept encrypted. Passwords stay hidden until someone chooses to reveal or copy them, and that is logged.
export default function ClientVault({leadId}:{leadId:string}){
 const {me,people}=useZarn(),confirm=useConfirm();
 const [items,setItems]=useState<Item[]|null>(null),[admin,setAdmin]=useState(false),[err,setErr]=useState(''),[editing,setEditing]=useState<Item|'new'|null>(null),[log,setLog]=useState<Log[]|null>(null),[sharing,setSharing]=useState(false);
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
  <div className="zn-card-head"><h3><KeyRound size={15}/> Vault</h3><span className="zv-head-actions">{items&&items.length>0&&<button type="button" className="zn-btn" onClick={()=>setSharing(true)}><Send size={14}/>Share with client</button>}<button type="button" className="zn-btn is-primary" onClick={()=>setEditing('new')}><Plus size={14}/>Add</button></span></div>
  <p className="zv-note"><ShieldCheck size={14}/>Logins, API keys, env settings and files are encrypted before they are saved and stay hidden until you reveal or copy them. Only this client’s team and admins can open the vault, and every reveal is logged. Don’t put secrets in chat or tasks. To give something to the client, use Share with client.</p>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  {items===null?<p className="zn-loading">Loading…</p>:items.length?<ul className="zv-list">{items.map(i=><li key={i.id} className="zv-item">
   <div className="zv-head"><span className="zv-kind">{kindMeta[i.kind].icon}{kindMeta[i.kind].label}</span><b>{i.label}</b>{i.url&&<a href={/^https?:\/\//i.test(i.url)?i.url:`https://${i.url}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${i.label}`}><ExternalLink size={13}/>{i.url.replace(/^https?:\/\//i,'').replace(/\/$/,'')}</a>}
    <span className="zv-actions">{(i.created_by===me.user_id||admin)&&<><button type="button" aria-label="Edit" data-tip="Edit" onClick={()=>setEditing(i)}><Pencil size={14}/></button><button type="button" aria-label="Delete" data-tip="Delete" className="is-danger" onClick={()=>void remove(i)}><Trash2 size={14}/></button></>}</span></div>
   <div className="zv-rows">
    {i.kind==='file'?<div className="zv-row is-file"><small>File</small><span>{i.file_name} · {(i.file_size/1024).toFixed(i.file_size>1048576?0:1)} KB</span><a className="zn-btn" href={`/api/zarn/vault/file?id=${i.id}`}><Download size={13}/>Download</a></div>:<>
    {i.username&&<div className="zv-row"><small>{i.kind==='api'?'Name':'Username'}</small><span>{i.username}</span><button type="button" aria-label="Copy" onClick={()=>void copy(i,'user')}>{copied===`${i.id}:user`?<Check size={14}/>:<Copy size={14}/>}</button></div>}
    {i.has_secret&&<div className={`zv-row${i.kind==='env'?' is-env':''}`}><small>{i.kind==='api'?'Key':i.kind==='env'?'Settings':'Password'}</small>{i.kind==='env'&&shown?.id===i.id?<pre>{shown.secret}</pre>:<span className="zv-secret">{shown?.id===i.id?shown.secret:'••••••••••••'}</span>}
     <button type="button" aria-label={shown?.id===i.id?'Hide':'Reveal'} onClick={()=>void reveal(i)}>{shown?.id===i.id?<EyeOff size={14}/>:<Eye size={14}/>}</button>
     <button type="button" aria-label="Copy" onClick={()=>void copy(i,'secret')}>{copied===`${i.id}:secret`?<Check size={14}/>:<Copy size={14}/>}</button></div>}
    </>}
    {i.note&&<div className="zv-row is-note"><small>Note</small><span>{i.note}</span></div>}
   </div></li>)}</ul>
   :<div className="zn-empty-state"><KeyRound size={26}/><h2>Nothing saved yet</h2><p>Keep this client’s logins, API keys, env settings and secret files here instead of in tasks or chat.</p></div>}
  {admin&&log&&log.length>0&&<section className="zv-log"><h4>Recent activity</h4><ul>{log.map(l=><li key={l.id}><b>{l.user_id===me.user_id?'You':l.user_id?people[l.user_id]?.display_name??'Someone':'The client'}</b> {verb[l.action]??l.action} <i>{l.item_label}</i><time>{dayOf(l.at)} {timeOf(l.at)}</time></li>)}</ul></section>}
  {sharing&&items&&<ShareVault leadId={leadId} items={items} onClose={()=>setSharing(false)} onChanged={()=>void load()}/>}
  {editing&&<VaultForm leadId={leadId} item={editing==='new'?null:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);void load();}}/>}
 </div></div>;
}
function VaultForm({leadId,item,onClose,onSaved}:{leadId:string;item:Item|null;onClose:()=>void;onSaved:()=>void}){
 const [kind,setKind]=useState<Kind>(item?.kind??'login'),[label,setLabel]=useState(item?.label??''),[url,setUrl]=useState(item?.url??''),[username,setUsername]=useState(item?.username??''),[secret,setSecret]=useState(''),[note,setNote]=useState(item?.note??''),[file,setFile]=useState<File|null>(null),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   if(kind==='file'){
    if(!file)throw new Error('Choose a file.');
    const form=new FormData();form.set('lead_id',leadId);form.set('label',label);form.set('note',note);form.set('file',file);
    const r=await fetch('/api/zarn/vault/file',{method:'POST',body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not save the file.');
   }else if(item)await api({action:'update',id:item.id,label,url,username,note,...(secret?{secret}:{})});
   else await api({action:'create',lead_id:leadId,kind,label,url,username,note,secret});
   onSaved();
  }catch(err){setError(err instanceof Error?err.message:'Could not save.');setBusy(false);}
 }
 const names:Record<Kind,string>={login:'e.g. Hosting, Website admin, Church email',api:'e.g. Stripe, Google Maps, Resend',env:'e.g. .env.production',file:'e.g. Production env file, SSL certificate'};
 return <Modal title={item?'Edit':'Add to the vault'} onClose={onClose}><form className="zn-modal-body" onSubmit={save} autoComplete="off">
  {!item&&<div className="zv-kinds" role="radiogroup" aria-label="What are you adding?">{(['login','api','env','file'] as Kind[]).map(k=><button key={k} type="button" role="radio" aria-checked={kind===k} className={kind===k?'is-on':''} onClick={()=>setKind(k)}>{kindMeta[k].icon}{kindMeta[k].label}</button>)}</div>}
  <label className="zn-label">Name<input className="zn-input" autoFocus required maxLength={120} value={label} onChange={e=>setLabel(e.target.value)} placeholder={names[kind]}/></label>
  {kind==='login'&&<><label className="zn-label">Website (optional)<input className="zn-input" maxLength={500} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></label>
   <label className="zn-label">Username or email<input className="zn-input" maxLength={300} autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)}/></label></>}
  {kind==='api'&&<label className="zn-label">Key name (optional)<input className="zn-input" maxLength={300} value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. STRIPE_SECRET_KEY"/></label>}
  {(kind==='login'||kind==='api')&&<div className="zn-label">{kind==='api'?'Key':'Password'}{item?.has_secret&&<small> (leave empty to keep the current one)</small>}
   <div className="zv-pass"><input className="zn-input" type={show?'text':'password'} autoComplete="new-password" maxLength={20000} value={secret} onChange={e=>setSecret(e.target.value)}/>
    <button type="button" className="zn-btn" onClick={()=>setShow(v=>!v)} aria-label={show?'Hide':'Show'}>{show?<EyeOff size={14}/>:<Eye size={14}/>}</button>
    {kind==='login'&&<button type="button" className="zn-btn" onClick={()=>{setSecret(strong());setShow(true);}} data-tip="Generate a strong password"><RefreshCw size={14}/></button>}</div></div>}
  {kind==='env'&&<label className="zn-label">Settings{item?.has_secret&&<small> (leave empty to keep the current ones)</small>}<textarea className="zn-input zv-env" rows={9} spellCheck={false} maxLength={20000} value={secret} onChange={e=>setSecret(e.target.value)} placeholder={'API_KEY=...\nDATABASE_URL=...\nPaste the whole .env file here'}/></label>}
  {kind==='file'&&<label className="zn-label">File (up to 4 MB)<input className="zn-input" type="file" required onChange={e=>setFile(e.target.files?.[0]??null)}/></label>}
  <label className="zn-label">Note (optional)<textarea className="zn-input" rows={2} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="What it's for, who has access, when to rotate it…"/></label>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!label.trim()}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}
type ShareRow={id:string;label:string;expires_at:string;view_once:boolean;opened_at:string|null;revoked_at:string|null;created_at:string};
// Hand chosen items to the client: pick the items, set a password and an expiry, send them the link (and the password separately).
function ShareVault({leadId,items,onClose,onChanged}:{leadId:string;items:Item[];onClose:()=>void;onChanged:()=>void}){
 const confirm=useConfirm();
 const [picked,setPicked]=useState<string[]>([]),[password,setPassword]=useState(''),[hours,setHours]=useState('168'),[once,setOnce]=useState(false),[label,setLabel]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[made,setMade]=useState<{url:string;pw:string}|null>(null),[shares,setShares]=useState<ShareRow[]>([]),[copied,setCopied]=useState('');
 const loadShares=useCallback(async()=>{try{setShares((await api({action:'share_list',lead_id:leadId})).shares);}catch{}},[leadId]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void loadShares();},[loadShares]);
 async function create(){
  setBusy(true);setErr('');
  try{const d=await api({action:'share_create',lead_id:leadId,item_ids:picked,label,password,hours:Number(hours),view_once:once});setMade({url:d.share.url,pw:password});setPassword('');setPicked([]);await loadShares();onChanged();}
  catch(e){setErr(e instanceof Error?e.message:'Could not create the link.');}
  setBusy(false);
 }
 const status=(s:ShareRow)=>s.revoked_at?'Turned off':new Date(s.expires_at)<new Date()?'Expired':s.view_once&&s.opened_at?'Opened (view once)':s.opened_at?'Opened':'Not opened yet';
 return <Modal title="Share with the client" onClose={onClose} wide><div className="zn-modal-body zv-share">
  {made?<div className="zv-made"><p><b>Link created.</b> Send the client the link, and the password in a separate message (for example by phone or a different app).</p>
   <div className="zv-copyrow"><span>{made.url}</span><button type="button" className="zn-btn" onClick={()=>{void navigator.clipboard.writeText(made.url);setCopied('url');setTimeout(()=>setCopied(''),1500);}}>{copied==='url'?<Check size={13}/>:<Copy size={13}/>}Copy link</button></div>
   <div className="zv-copyrow"><span>Password: <b>{made.pw}</b></span><button type="button" className="zn-btn" onClick={()=>{void navigator.clipboard.writeText(made.pw);setCopied('pw');setTimeout(()=>setCopied(''),1500);}}>{copied==='pw'?<Check size={13}/>:<Copy size={13}/>}Copy password</button></div>
   <button type="button" className="zn-btn" onClick={()=>setMade(null)}>Create another</button></div>
  :<>
   <p className="zn-note">Only what you pick goes in the link. The client sees it behind a password, with no ZARN account needed. You can turn the link off at any time, and every open and reveal is logged.</p>
   <ul className="zv-pick">{items.map(i=><li key={i.id}><label><input type="checkbox" checked={picked.includes(i.id)} onChange={()=>setPicked(p=>p.includes(i.id)?p.filter(x=>x!==i.id):[...p,i.id])}/>{kindMeta[i.kind].icon}<span>{i.label}</span><small>{kindMeta[i.kind].label}</small></label></li>)}</ul>
   <label className="zn-label">Title the client sees (optional)<input className="zn-input" maxLength={120} value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Your website handover"/></label>
   <div className="zn-form-row">
    <div className="zn-label">Password for the link<div className="zv-pass"><input className="zn-input" type="text" autoComplete="off" value={password} maxLength={100} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/><button type="button" className="zn-btn" onClick={()=>setPassword(strong().slice(0,14))} data-tip="Generate one"><RefreshCw size={14}/></button></div></div>
    <div className="zn-label">Link works for<Dropdown label="Expiry" value={hours} onChange={setHours} options={[{value:'24',label:'1 day'},{value:'72',label:'3 days'},{value:'168',label:'7 days'},{value:'720',label:'30 days'}]}/></div>
   </div>
   <label className="zv-check"><input type="checkbox" checked={once} onChange={e=>setOnce(e.target.checked)}/>View once: the link stops working after it has been opened</label>
   {err&&<p className="zn-error" role="alert">{err}</p>}
   <button type="button" className="zn-btn is-primary" disabled={busy||!picked.length||password.length<6} onClick={()=>void create()}><Link2 size={14}/>{busy?'Creating…':`Create link${picked.length?` for ${picked.length} item${picked.length===1?'':'s'}`:''}`}</button>
  </>}
  {shares.length>0&&<section><h4 className="zv-h4">Links you made</h4><ul className="zv-shares">{shares.map(s=><li key={s.id}><span><b>{s.label||'Client link'}</b><small>{status(s)} · until {new Date(s.expires_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></span>
   {!s.revoked_at&&new Date(s.expires_at)>new Date()&&<button type="button" className="zn-remove" onClick={async()=>{if(!await confirm({title:'Turn off this link?',message:'The client will lose access straight away.',confirm:'Turn off',danger:true}))return;await api({action:'share_revoke',id:s.id});await loadShares();onChanged();}}>Turn off</button>}</li>)}</ul></section>}
 </div></Modal>;
}
