'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Bookmark,Phone,Check,CheckCheck,ChevronLeft,ChevronRight,Clock3,Download,FileText,MessageSquareText,Pencil,Pin,SmilePlus,Trash2,TrendingUp,Receipt,UserPlus,X} from 'lucide-react';
import {quickReactions,zarnApi,type ZMessage,type ZReaction} from '@/lib/zarn';
import {money} from '@/lib/crm';
import {useZarn} from './ZarnProvider';
import {useShell} from './nav';
import DocViewer,{docKind} from './DocViewer';
import {useCall} from './CallProvider';
import VoicePlayer from './VoicePlayer';
import {Avatar,StatusMark,renderBody,timeOf,tokensToText,textToTokens} from './format';

// One message row. compact = same author as the previous message within a few minutes (no avatar/name).
export type Receipt={pending:boolean;seen:{id:string;at:string}[];unseen:string[];delivered:string[]};
export default function Message({m,reactions,compact,inThread,onThread,receipt}:{m:ZMessage;reactions:ZReaction[];compact:boolean;inThread?:boolean;onThread?:(m:ZMessage)=>void;receipt?:Receipt}){
 const {me,people,members,db,membership,channels,emit,saved,toggleSaved}=useZarn(),{profile}=useShell(),call=useCall();
 const [viewer,setViewer]=useState<number|null>(null),[doc,setDoc]=useState<number|null>(null),[seenOpen,setSeenOpen]=useState(false);
 const [tapped,setTapped]=useState(false),[picker,setPicker]=useState(false),[editing,setEditing]=useState(false),[draft,setDraft]=useState(''),[confirm,setConfirm]=useState(false);
 const author=m.user_id?people[m.user_id]:undefined,mine=m.user_id===me.user_id,canAct=!!membership[m.channel_id];
 const groups=reactions.reduce<Record<string,string[]>>((g,r)=>{(g[r.emoji]??=[]).push(r.user_id);return g;},{});
 async function toggle(emoji:string){
  setPicker(false);if(!canAct)return;
  const has=reactions.some(r=>r.emoji===emoji&&r.user_id===me.user_id);
  const row={message_id:m.id,user_id:me.user_id,channel_id:m.channel_id,emoji};
  emit({table:'zarn_reactions',type:has?'DELETE':'INSERT',row});
  const {error}=has?await db.from('zarn_reactions').delete().eq('message_id',m.id).eq('user_id',me.user_id).eq('emoji',emoji):await db.from('zarn_reactions').insert(row);
  if(error)emit({table:'zarn_reactions',type:has?'INSERT':'DELETE',row});
 }
 async function saveEdit(){
  const body=textToTokens(draft.trim(),members);if(!body||body===m.body){setEditing(false);return;}
  const edited_at=new Date().toISOString();emit({table:'zarn_messages',type:'UPDATE',row:{...m,body,edited_at}});
  await db.from('zarn_messages').update({body,edited_at}).eq('id',m.id);setEditing(false);
 }
 const remove=async()=>{const deleted_at=new Date().toISOString();emit({table:'zarn_messages',type:'UPDATE',row:{...m,body:'',deleted_at}});await db.from('zarn_messages').update({deleted_at,body:''}).eq('id',m.id);setConfirm(false);};
 const pin=()=>void zarnApi('/api/zarn',{action:'pin',message_id:m.id,pinned:!m.pinned_at}).catch(()=>{});

 if(m.kind==='system'){
  // A missed or declined call gets a one-tap call back.
  const missed=m.meta.event==='call'&&(m.meta.status==='missed'||m.meta.status==='declined');
  const ch=channels.find(c=>c.id===m.channel_id),by=String(m.meta.by??'');
  const peer=by===me.user_id?(ch?.dm_key??'').split(',').find(u=>u!==me.user_id):by;
  return <div className="zn-system">{systemText(m,people)}{missed&&peer&&ch?.kind==='dm'&&<button type="button" className="zn-callback" disabled={call.busy} onClick={()=>void call.start(m.channel_id,peer)}><Phone size={12}/>{by===me.user_id?'Call again':'Call back'}</button>}</div>;
 }
 if(m.deleted_at)return <div className={`zn-msg${compact?' is-compact':''}`}><div className="zn-gutter">{!compact&&<Avatar m={author}/>}</div><div className="zn-msg-main"><p className="zn-deleted">This message was deleted.</p></div></div>;

 // Touch screens have no hover: tapping a message (not a link or button) shows its action bar.
 const onTap=(e:React.MouseEvent)=>{if(!window.matchMedia('(hover: none)').matches)return;if((e.target as HTMLElement).closest('a,button,textarea,input'))return;setTapped(v=>!v);};
 return <div className={`zn-msg${compact?' is-compact':''}${m.pinned_at?' is-pinned':''}${m.pending?' is-pending':''}${tapped?' is-tapped':''}`} id={`m-${m.id}`} onClick={onTap}>
  <div className="zn-gutter">{compact?<time className="zn-hover-time">{timeOf(m.created_at)}</time>:m.kind==='crm'?<span className="zn-crm-ico"><TrendingUp size={14}/></span>:<button type="button" className="zn-author-btn" aria-label={`${author?.display_name??'Member'}’s profile`} onClick={()=>m.user_id&&profile(m.user_id)}><Avatar m={author}/></button>}</div>
  <div className="zn-msg-main">
   {!compact&&<p className={`zn-msg-head${m.kind==='crm'?' is-crm':''}`}>{m.kind==='crm'?<b>CRM</b>:<button type="button" className="zn-author-name" onClick={()=>m.user_id&&profile(m.user_id)}>{author?.display_name??'Former member'}</button>}{m.kind!=='crm'&&<StatusMark m={author}/>}{m.kind==='crm'&&<span className="zn-app-tag">APP</span>}<time title={new Date(m.created_at).toLocaleString('en-GB')}>{timeOf(m.created_at)}</time>{m.pinned_at&&<span className="zn-pin-tag"><Pin size={11}/>Pinned</span>}</p>}
   {editing?<div className="zn-edit"><textarea autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void saveEdit();}if(e.key==='Escape')setEditing(false);}}/><div><button type="button" onClick={()=>setEditing(false)}>Cancel</button><button type="button" className="is-primary" onClick={()=>void saveEdit()}>Save</button></div></div>
    :m.body&&<div className="zn-body">{renderBody(m.body,people,me.user_id)}{m.edited_at&&<span className="zn-edited"> (edited)</span>}</div>}
   {m.kind==='crm'&&<CrmEvent m={m}/>}
   {m.kind!=='crm'&&m.lead_id&&<LeadCard id={m.lead_id}/>}
   {m.attachments.length>0&&<div className="zn-files">{m.attachments.map((a,i)=>a.type.startsWith('image/')&&a.type!=='image/svg+xml'
    ?<button type="button" key={i} className="zn-image" aria-label={`Open ${a.name}`} onClick={()=>setViewer(i)}><img src={`/api/zarn/files?m=${m.id}&i=${i}`} alt={a.name} loading="lazy"/></button>
    :a.type.startsWith('audio/')?<VoicePlayer key={i} messageId={m.id} index={i} att={a}/>
    :docKind(a)?<button type="button" key={i} className="zn-file" onClick={()=>setDoc(i)}><FileText size={18}/><span><b>{a.name}</b><small>{(a.size/1024).toFixed(a.size>1024*1024?0:1)} KB · Click to preview</small></span><Download size={15}/></button>
    :<a key={i} href={`/api/zarn/files?m=${m.id}&i=${i}&download=1`} className="zn-file"><FileText size={18}/><span><b>{a.name}</b><small>{(a.size/1024).toFixed(a.size>1024*1024?0:1)} KB</small></span><Download size={15}/></a>)}</div>}
   {Object.keys(groups).length>0&&<div className="zn-reactions">{Object.entries(groups).map(([e,users])=><button key={e} type="button" className={users.includes(me.user_id)?'is-mine':''} title={users.map(u=>people[u]?.display_name??'Someone').join(', ')} onClick={()=>void toggle(e)}>{e}<span>{users.length}</span></button>)}
    {canAct&&<button type="button" className="zn-react-add" aria-label="Add reaction" onClick={()=>setPicker(v=>!v)}><SmilePlus size={14}/></button>}</div>}
   {!inThread&&m.reply_count>0&&<button type="button" className="zn-thread-link" onClick={()=>onThread?.(m)}><MessageSquareText size={13}/>{m.reply_count} repl{m.reply_count===1?'y':'ies'}{m.last_reply_at&&<span>Last reply {timeOf(m.last_reply_at)}</span>}</button>}
   {receipt&&(()=>{
    // Sent: saved, recipient offline. Delivered: recipient's app has it. Seen: they opened the conversation.
    const state=receipt.pending?'pending':receipt.seen.length?(receipt.unseen.length?'some':'all'):receipt.delivered.length?'delivered':'sent';
    const label=state==='pending'?'Sending':state==='sent'?'Sent':state==='delivered'?'Delivered':state==='all'?(receipt.seen.length===1?`Seen ${timeOf(receipt.seen[0]!.at)}`:'Seen by everyone'):`Seen by ${receipt.seen.length}`;
    return <button type="button" className={`zn-ticks is-${state}`} aria-label={state==='some'?`Seen by ${receipt.seen.length} of ${receipt.seen.length+receipt.unseen.length}`:label} onClick={()=>setSeenOpen(v=>!v)}>
     {state==='pending'?<Clock3 size={13}/>:state==='sent'?<Check size={15}/>:<CheckCheck size={15}/>}
     {state!=='pending'&&<small>{label}</small>}
    </button>;})()}
   {seenOpen&&receipt&&<><button type="button" className="zn-scrim" aria-label="Close" onClick={()=>setSeenOpen(false)}/><div className="zn-seen-pop" role="dialog" aria-label="Message info">
    <p className="zn-seen-title">Seen by {receipt.seen.length}</p>
    {receipt.seen.sort((a,b)=>a.at.localeCompare(b.at)).map(r=><div key={r.id} className="zn-seen-row"><Avatar m={people[r.id]} size={26}/><span>{people[r.id]?.display_name??'Someone'}</span><time>{timeOf(r.at)}</time></div>)}
    {receipt.unseen.length>0&&<><p className="zn-seen-title">Not seen yet</p>{receipt.unseen.map(u=><div key={u} className="zn-seen-row is-dim"><Avatar m={people[u]} size={26}/><span>{people[u]?.display_name??'Someone'}</span></div>)}</>}
   </div></>}
  </div>
  {canAct&&!editing&&m.kind!=='crm'&&<div className="zn-actions" role="toolbar" aria-label="Message actions">
   {quickReactions.slice(0,3).map(e=><button key={e} type="button" aria-label={`React ${e}`} onClick={()=>void toggle(e)}>{e}</button>)}
   <button type="button" aria-label="More reactions" data-tip="React" onClick={()=>setPicker(v=>!v)}><SmilePlus size={15}/></button>
   {!inThread&&<button type="button" aria-label="Reply in thread" data-tip="Reply in thread" onClick={()=>onThread?.(m)}><MessageSquareText size={15}/></button>}
   <button type="button" aria-label={saved[m.id]?'Remove from saved':'Save for later'} data-tip={saved[m.id]?'Saved. Click to remove':'Save for later'} onClick={()=>void toggleSaved(m)} className={saved[m.id]?'is-on':''}><Bookmark size={15} fill={saved[m.id]?'currentColor':'none'}/></button>
   {!inThread&&<button type="button" aria-label={m.pinned_at?'Unpin':'Pin'} data-tip={m.pinned_at?'Unpin':'Pin to channel'} onClick={pin}><Pin size={15}/></button>}
   {mine&&<button type="button" aria-label="Edit" data-tip="Edit" onClick={()=>{setDraft(tokensToText(m.body,people));setEditing(true);}}><Pencil size={15}/></button>}
   {mine&&<button type="button" aria-label="Delete" data-tip="Delete" className="is-danger" onClick={()=>setConfirm(true)}><Trash2 size={15}/></button>}
  </div>}
  {canAct&&m.kind==='crm'&&<div className="zn-actions">{quickReactions.slice(0,3).map(e=><button key={e} type="button" aria-label={`React ${e}`} onClick={()=>void toggle(e)}>{e}</button>)}{!inThread&&<button type="button" aria-label="Reply in thread" onClick={()=>onThread?.(m)}><MessageSquareText size={15}/></button>}</div>}
  {picker&&<><button type="button" className="zn-scrim" aria-label="Close" onClick={()=>setPicker(false)}/><div className="zn-picker">{quickReactions.concat(['😮','😢','💯','🚀','👏','🤝','💡','⏳']).map(e=><button key={e} type="button" onClick={()=>void toggle(e)}>{e}</button>)}</div></>}
  {doc!==null&&m.attachments[doc]&&<DocViewer messageId={m.id} index={doc} att={m.attachments[doc]!} onClose={()=>setDoc(null)}/>}
  {viewer!==null&&<Viewer m={m} index={viewer} onIndex={setViewer} onClose={()=>setViewer(null)}/>}
  {confirm&&<div className="zn-confirm"><span>Delete this message?</span><button type="button" onClick={()=>setConfirm(false)}>Cancel</button><button type="button" className="is-danger" onClick={()=>void remove()}>Delete</button></div>}
 </div>;
}

function systemText(m:ZMessage,people:Record<string,{display_name:string}>){
 const by=people[String(m.meta.by??'')]?.display_name??'Someone';
 switch(m.meta.event){
  case 'channel_created':return `${by} created this channel.`;
  case 'topic':return m.meta.topic?`${by} set the topic: ${m.meta.topic}`:`${by} cleared the topic.`;
  case 'members_added':{const names=String(m.meta.users??'').split(',').map(id=>people[id]?.display_name).filter(Boolean);return `${by} added ${names.join(', ')||'people'}.`;}
  case 'members_removed':{const names=String(m.meta.users??'').split(',').map(id=>people[id]?.display_name).filter(Boolean);return `${by} removed ${names.join(', ')||'people'} from the team.`;}
  case 'members_invited':{const names=String(m.meta.users??'').split(',').map(id=>people[id]?.display_name).filter(Boolean);return `${by} invited ${names.join(', ')||'people'}. They need to accept to join.`;}
  case 'joined':return `${by} joined the channel.`;
  case 'call':{const d=Number(m.meta.duration)||0,t=m.meta.status;return t==='ended'?`Voice call · ${Math.floor(d/60)}:${String(d%60).padStart(2,'0')}`:t==='declined'?`${by} called. The call was declined.`:`Missed voice call from ${by}.`;}
  case 'client_opened':return `${by} opened this client space.`;
  default:return '';
 }
}

// Live summary of a CRM lead (read-only fields from the zarn_leads view).
export function LeadCard({id,compact}:{id:string;compact?:boolean}){
 const {lead,loadLead,me}=useZarn();const l=lead(id);
 useEffect(()=>{if(me.can_view_crm)loadLead(id);},[id,loadLead,me.can_view_crm]);
 if(!me.can_view_crm)return <div className="zn-lead is-loading">A CRM lead was shared here. Ask an admin for CRM access to see it.</div>;
 const staff=me.staffRole&&['super_admin','admin','sales'].includes(me.staffRole);
 if(!l)return <div className="zn-lead is-loading">Loading lead…</div>;
 return <div className={`zn-lead${compact?' is-compact':''}`}>
  <div className="zn-lead-top"><b>{l.name}</b>{l.stage_label&&<span className="zn-stage" style={{background:l.stage_color??'#52525b'}}>{l.stage_label}</span>}</div>
  <p>{[l.company,l.service_interested].filter(Boolean).join(' · ')||'No company'}</p>
  <div className="zn-lead-meta">{l.deal_value!=null&&<span>{money(Number(l.deal_value),l.currency)}</span>}{l.owner_name&&<span>Owner: {l.owner_name}</span>}{l.categories.slice(0,3).map(c=><span key={c} className="zn-cat">{c}</span>)}</div>
  <div className="zn-lead-links"><Link href={`/zarn/crm?lead=${l.id}`}>View in CRM</Link>{staff&&<a href={`/admin/leads/${l.id}`} target="_blank" rel="noopener noreferrer">Open in admin</a>}</div>
 </div>;
}

function CrmEvent({m}:{m:ZMessage}){
 const {lead,loadLead,me}=useZarn();const l=m.lead_id?lead(m.lead_id):undefined;
 useEffect(()=>{if(m.lead_id)loadLead(m.lead_id);},[m.lead_id,loadLead]);
 const e=String(m.meta.event);const name=l?.company||l?.name||'a lead';
 const src=String(m.meta.source??'');
 const to=String(m.meta.to??'');
 const current=!!l&&l.status===m.meta.to;
 const stage=<span className="zn-crm-stage"><i style={{background:current?l?.stage_color??'#71717a':'#71717a'}}/>{current&&l?.stage_label?l.stage_label:to.charAt(0).toUpperCase()+to.slice(1)}</span>;
 const Icon=e==='lead_created'?UserPlus:e==='stage'?TrendingUp:Receipt;
 const text=e==='lead_created'?<>{src==='website'||src==='partnership'?'New website lead':src==='other'?'New client added':`New lead (${src})`} <b>{name}</b></>
  :e==='stage'?<><b>{name}</b> moved to {stage}</>
  :e==='invoice_sent'?<>Invoice <b>{String(m.meta.number)}</b> sent to <b>{name}</b> <span className="zn-crm-amt">{money(Number(m.meta.total),String(m.meta.currency))}</span></>
  :e==='invoice_paid'?<>Invoice <b>{String(m.meta.number)}</b> paid by <b>{name}</b> <span className="zn-crm-amt is-paid">{money(Number(m.meta.total),String(m.meta.currency))}</span></>:null;
 const staff=!!me.staffRole&&['super_admin','admin','sales'].includes(me.staffRole);
 const sub=l?[l.company?l.name:null,l.service_interested,l.deal_value!=null?money(Number(l.deal_value),l.currency):null,l.owner_name].filter(Boolean):[];
 return <div className="zn-crm"><div className="zn-crm-body">
  <p><Icon size={13} className="zn-crm-mini"/>{text}<time title={new Date(m.created_at).toLocaleString('en-GB')}>{timeOf(m.created_at)}</time></p>
  {me.can_view_crm&&m.lead_id&&<div className="zn-crm-sub">{sub.length>0&&<span>{sub.join(' · ')}</span>}<Link href={`/zarn/crm?lead=${m.lead_id}`}>View in CRM</Link>{staff&&<a href={`/admin/leads/${m.lead_id}`} target="_blank" rel="noopener noreferrer">Open in admin</a>}</div>}
 </div></div>;
}

// In-app photo viewer: full screen, close, download, previous/next across the message's images. Esc and arrow keys work.
function Viewer({m,index,onIndex,onClose}:{m:ZMessage;index:number;onIndex:(i:number)=>void;onClose:()=>void}){
 const imgs=m.attachments.map((a,i)=>({a,i})).filter(x=>x.a.type.startsWith('image/')&&x.a.type!=='image/svg+xml');
 const pos=Math.max(0,imgs.findIndex(x=>x.i===index)),cur=imgs[pos]!;
 const go=(d:number)=>{const n=imgs[(pos+d+imgs.length)%imgs.length];if(n)onIndex(n.i);};
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1);};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);});
 const [start,setStart]=useState<number|null>(null);
 return <div className="zn-viewer" role="dialog" aria-label={cur.a.name} onClick={onClose} onTouchStart={e=>setStart(e.touches[0]!.clientX)} onTouchEnd={e=>{if(start!==null&&imgs.length>1){const dx=e.changedTouches[0]!.clientX-start;if(Math.abs(dx)>50)go(dx<0?1:-1);}setStart(null);}}>
  <div className="zn-viewer-bar" onClick={e=>e.stopPropagation()}>
   <span>{cur.a.name}{imgs.length>1&&<small> · {pos+1} of {imgs.length}</small>}</span>
   <a href={`/api/zarn/files?m=${m.id}&i=${cur.i}&download=1`} aria-label="Download"><Download size={20}/></a>
   <button type="button" aria-label="Close" onClick={onClose}><X size={22}/></button>
  </div>
  <img src={`/api/zarn/files?m=${m.id}&i=${cur.i}`} alt={cur.a.name} onClick={e=>e.stopPropagation()}/>
  {imgs.length>1&&<><button type="button" className="zn-viewer-nav is-prev" aria-label="Previous" onClick={e=>{e.stopPropagation();go(-1);}}><ChevronLeft size={26}/></button><button type="button" className="zn-viewer-nav is-next" aria-label="Next" onClick={e=>{e.stopPropagation();go(1);}}><ChevronRight size={26}/></button></>}
 </div>;
}
