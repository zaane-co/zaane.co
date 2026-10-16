'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Download,FileText,Files as FilesIcon,Search} from 'lucide-react';
import {channelHref,type ZAttachment,type ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {dayOf} from './format';

type Item={key:string;m:Pick<ZMessage,'id'|'channel_id'|'user_id'|'created_at'>;i:number;a:ZAttachment};
type Kind='all'|'images'|'documents'|'other';
const isImage=(a:ZAttachment)=>a.type.startsWith('image/')&&a.type!=='image/svg+xml';
const isDoc=(a:ZAttachment)=>/pdf|word|document|sheet|excel|presentation|powerpoint|text\//.test(a.type)||/\.(pdf|docx?|xlsx?|pptx?|csv|txt|md)$/i.test(a.name);
const size=(n:number)=>n>1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;

// Every file shared in the conversations you can read, newest first.
export default function Files(){
 const {db,people,channels,title}=useZarn();
 const [items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[q,setQ]=useState(''),[kind,setKind]=useState<Kind>('all');
 useEffect(()=>{void (async()=>{
  const {data}=await db.from('zarn_messages').select('id,channel_id,user_id,attachments,created_at').neq('attachments','[]').is('deleted_at',null).order('created_at',{ascending:false}).limit(500);
  const rows=(data??[]) as (Item['m']&{attachments:ZAttachment[]})[];
  setItems(rows.flatMap(m=>(m.attachments??[]).map((a,i)=>({key:`${m.id}:${i}`,m:{id:m.id,channel_id:m.channel_id,user_id:m.user_id,created_at:m.created_at},i,a}))));
  setLoading(false);
 })();},[db]);
 const counts=useMemo(()=>({all:items.length,images:items.filter(x=>isImage(x.a)).length,documents:items.filter(x=>!isImage(x.a)&&isDoc(x.a)).length,other:items.filter(x=>!isImage(x.a)&&!isDoc(x.a)).length}),[items]);
 const shown=items.filter(x=>(kind==='all'||(kind==='images'?isImage(x.a):kind==='documents'?!isImage(x.a)&&isDoc(x.a):!isImage(x.a)&&!isDoc(x.a)))&&`${x.a.name} ${people[x.m.user_id??'']?.display_name??''}`.toLowerCase().includes(q.toLowerCase()));
 const where=(id:string)=>{const c=channels.find(x=>x.id===id);return c?(c.kind==='dm'||c.kind==='client'?title(c):`#${c.name}`):'a channel';};
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><FilesIcon size={20}/>Files</h1><p>Everything shared in the conversations you’re part of.</p></div></header>
  <div className="zn-tools">
   <label className="zn-tool-search"><Search size={15}/><input placeholder="Search by file name or person" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search files"/></label>
   <div className="zn-pills" role="tablist" aria-label="File type">{(['all','images','documents','other'] as const).map(k=><button key={k} type="button" role="tab" aria-selected={kind===k} className={kind===k?'is-on':''} onClick={()=>setKind(k)}>{k==='all'?'All':k[0].toUpperCase()+k.slice(1)} <span>{counts[k]}</span></button>)}</div>
  </div>
  <div className="zn-crm-list" data-lenis-prevent>
   {loading?<p className="zn-loading">Loading…</p>:shown.length?<div className="zn-file-grid">{shown.map(x=>{const c=channels.find(ch=>ch.id===x.m.channel_id);return <article key={x.key} className="zn-file-card">
    {isImage(x.a)?<a href={`/api/zarn/files?m=${x.m.id}&i=${x.i}`} target="_blank" rel="noopener noreferrer" className="zn-file-thumb" aria-label={`Open ${x.a.name}`}><img src={`/api/zarn/files?m=${x.m.id}&i=${x.i}`} alt={x.a.name} loading="lazy"/></a>
     :<a href={`/api/zarn/files?m=${x.m.id}&i=${x.i}&download=1`} className="zn-file-thumb is-doc" aria-label={`Download ${x.a.name}`}><FileText size={30}/><em>{(x.a.name.split('.').pop()||'file').slice(0,5)}</em></a>}
    <div className="zn-file-meta"><b title={x.a.name}>{x.a.name}</b><small>{size(x.a.size)} · {people[x.m.user_id??'']?.display_name??'Someone'} · {dayOf(x.m.created_at)}</small>
     <div className="zn-file-links"><Link href={channelHref(c,x.m.channel_id)}>{where(x.m.channel_id)}</Link><a href={`/api/zarn/files?m=${x.m.id}&i=${x.i}&download=1`} aria-label={`Download ${x.a.name}`}><Download size={13}/></a></div></div>
   </article>;})}</div>
   :<div className="zn-empty-state"><h2>{items.length?'No files match':'No files yet'}</h2><p>{items.length?'Try another search or type.':'Files you or your team attach to messages show up here.'}</p></div>}
  </div>
 </div>;
}
