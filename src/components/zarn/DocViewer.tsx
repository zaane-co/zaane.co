'use client';
import {useEffect,useState} from 'react';
import {Download,FileText,Loader2,X} from 'lucide-react';
import type {ZAttachment} from '@/lib/zarn';
// In-app document preview: PDFs, Word (.docx), CSV tables and plain text. Anything else offers a download.
export type DocKind='pdf'|'docx'|'csv'|'text'|'image'|null;
export const docKind=(a:Pick<ZAttachment,'name'|'type'>):DocKind=>{
 const n=a.name.toLowerCase();
 if(/^image\/(jpeg|png|webp|gif|avif)$/.test(a.type))return 'image';
 if(a.type==='application/pdf'||n.endsWith('.pdf'))return 'pdf';
 if(n.endsWith('.docx')||a.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return 'docx';
 if(n.endsWith('.csv')||a.type==='text/csv')return 'csv';
 if(a.type.startsWith('text/')||/\.(txt|md|json|log|xml|ya?ml)$/.test(n))return 'text';
 return null;
};
// Small CSV reader that understands quoted fields.
function parseCsv(t:string){
 const rows:string[][]=[];let row:string[]=[],cell='',q=false;
 for(let i=0;i<t.length;i++){const c=t[i]!;
  if(q){if(c==='"'){if(t[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;}
  else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=c;}
 if(cell||row.length){row.push(cell);rows.push(row);}
 return rows.slice(0,1000);
}
// Message attachments pass messageId + index; other files (like a client's Files tab) pass src and download links directly.
export default function DocViewer({messageId,index,att,src:srcProp,dl:dlProp,onClose}:{messageId?:string;index?:number;att:Pick<ZAttachment,'name'|'type'>;src?:string;dl?:string;onClose:()=>void}){
 const kind=docKind(att),src=srcProp??`/api/zarn/files?m=${messageId}&i=${index}`,dl=dlProp??`${src}&download=1`;
 const [text,setText]=useState<string|null>(null),[html,setHtml]=useState<string|null>(null),[err,setErr]=useState('');
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 useEffect(()=>{
  if(kind!=='text'&&kind!=='csv'&&kind!=='docx')return;
  let live=true;
  void (async()=>{
   try{
    const r=await fetch(srcProp??dl);if(!r.ok)throw new Error();
    if(kind==='docx'){const mammoth=await import('mammoth');const out=await mammoth.convertToHtml({arrayBuffer:await r.arrayBuffer()});if(live)setHtml(out.value);}
    else{const t=await r.text();if(live)setText(t.slice(0,500_000));}
   }catch{if(live)setErr('This file couldn’t be previewed. You can still download it.');}
  })();
  return()=>{live=false;};
 },[kind,dl,srcProp]);
 const loading=(kind==='text'||kind==='csv')?text===null:kind==='docx'?html===null:false;
 const rows=kind==='csv'&&text?parseCsv(text):[];
 return <div className="zn-doc" role="dialog" aria-label={att.name} onClick={onClose}>
  <div className="zn-doc-card" onClick={e=>e.stopPropagation()}>
   <header><FileText size={16}/><b title={att.name}>{att.name}</b><a href={dl} aria-label="Download" data-tip="Download"><Download size={17}/></a><button type="button" aria-label="Close" onClick={onClose}><X size={19}/></button></header>
   <div className="zn-doc-body">
    {kind==='image'&&<div className="zn-doc-img"><img src={src} alt={att.name}/></div>}
    {kind==='pdf'&&<iframe title={att.name} src={src}/>}
    {kind==='docx'&&html!==null&&<iframe title={att.name} sandbox="" srcDoc={`<style>body{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 20px;color:#111}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>${html}`}/>}
    {kind==='csv'&&text!==null&&<div className="zn-doc-scroll"><table className="zn-doc-table"><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=>i===0?<th key={j}>{c}</th>:<td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
    {kind==='text'&&text!==null&&<pre className="zn-doc-text">{text}</pre>}
    {kind===null&&<div className="zn-doc-none"><FileText size={32}/><p>This file type can’t be previewed in ZARN.</p><a className="zn-btn is-primary" href={dl}><Download size={14}/>Download</a></div>}
    {loading&&!err&&<div className="zn-doc-none"><Loader2 size={24} className="zn-spin"/></div>}
    {err&&<div className="zn-doc-none"><p>{err}</p><a className="zn-btn is-primary" href={dl}><Download size={14}/>Download</a></div>}
   </div>
  </div>
 </div>;
}
