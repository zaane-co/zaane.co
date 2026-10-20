import {Fragment,type ReactNode} from 'react';
import {liveStatus,type ZMember} from '@/lib/zarn';
// Message formatting without HTML injection: the body is tokenised into React nodes.
// Supports ```code blocks```, `code`, *bold*, _italic_, ~strike~, links, <@user> mentions and <!channel>.
const inline=/(`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s<]+[^\s<.,:;"')\]]|<@[0-9a-f-]{36}>|<!channel>)/g;
function inlineNodes(text:string,people:Record<string,ZMember>,me:string,key:string):ReactNode[]{
 return text.split(inline).map((part,i)=>{
  const k=`${key}-${i}`;
  if(!part)return null;
  if(part.startsWith('`')&&part.endsWith('`')&&part.length>2)return <code key={k}>{part.slice(1,-1)}</code>;
  if(part.startsWith('*')&&part.endsWith('*')&&part.length>2)return <strong key={k}>{part.slice(1,-1)}</strong>;
  if(part.startsWith('_')&&part.endsWith('_')&&part.length>2)return <em key={k}>{part.slice(1,-1)}</em>;
  if(part.startsWith('~')&&part.endsWith('~')&&part.length>2)return <s key={k}>{part.slice(1,-1)}</s>;
  if(/^https?:\/\//.test(part))return <a key={k} href={part} target="_blank" rel="noopener noreferrer">{part}</a>;
  const m=part.match(/^<@([0-9a-f-]{36})>$/);
  if(m)return <span key={k} className={`zn-mention${m[1]===me?' is-me':''}`}>@{people[m[1]!]?.display_name??'former member'}</span>;
  if(part==='<!channel>')return <span key={k} className="zn-mention is-me">@channel</span>;
  return <Fragment key={k}>{part}</Fragment>;
 });
}
export function renderBody(body:string,people:Record<string,ZMember>,me:string){
 return body.split(/```/).map((chunk,i)=>i%2?<pre key={i}><code>{chunk.replace(/^\n/,'')}</code></pre>
  :<Fragment key={i}>{chunk.split('\n').map((line,j,arr)=><Fragment key={j}>{line.startsWith('> ')?<span className="zn-quote">{inlineNodes(line.slice(2),people,me,`${i}-${j}`)}</span>:inlineNodes(line,people,me,`${i}-${j}`)}{j<arr.length-1&&<br/>}</Fragment>)}</Fragment>);
}
// For editing: tokens back to readable @names, and a map to turn them into tokens again on save.
export const tokensToText=(body:string,people:Record<string,ZMember>)=>body.replace(/<@([0-9a-f-]{36})>/g,(_,id:string)=>`@${people[id]?.display_name??'former member'}`).replace(/<!channel>/g,'@channel');
export function textToTokens(text:string,people:ZMember[]){
 let out=text.replace(/@channel\b/g,'<!channel>');
 // Longest names first so "Ada O" doesn't eat "Ada Okafor".
 for(const p of [...people].sort((a,b)=>b.display_name.length-a.display_name.length))out=out.split(`@${p.display_name}`).join(`<@${p.user_id}>`);
 // Typed @usernames work too (whole word only, so @isaac doesn't match @isaac.o).
 for(const p of [...people].filter(p=>p.username).sort((a,b)=>b.username!.length-a.username!.length))out=out.replace(new RegExp(`@${p.username!.replace(/[.]/g,'\\.')}(?![a-z0-9._])`,'gi'),`<@${p.user_id}>`);
 return out;
}
export const plain=(body:string,people:Record<string,ZMember>)=>tokensToText(body,people).replace(/[*_~`]/g,'');
const palette=['#f10c45','#2563eb','#16a34a','#7c3aed','#f59e0b','#0891b2','#db2777','#4f46e5'];
export const colorFor=(id:string)=>palette[[...id].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7)%palette.length]!;
export const initialsOf=(s:string)=>s.split(/[\s@.]+/).filter(Boolean).slice(0,2).map(w=>w[0]!.toUpperCase()).join('')||'?';
// `name` is the fallback for someone no longer in ZARN (their saved author name).
export function Avatar({m,size=36,online,name:fallback}:{m?:ZMember;size?:number;online?:boolean;name?:string|null}){
 const name=m?.display_name??fallback??'?';
 return <span className="zn-avatar" style={{width:size,height:size,fontSize:size*.38,background:m?colorFor(m.user_id):'#52525b'}}>
  {m?.avatar_url?<img src={m.avatar_url} alt=""/>:initialsOf(name)}
  {online!==undefined&&<i className={`zn-dot${online?' is-on':''}`}/>}
 </span>;
}
export function timeOf(d:string){return new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
export function dayOf(d:string){
 const x=new Date(d),t=new Date();const y=new Date();y.setDate(t.getDate()-1);
 if(x.toDateString()===t.toDateString())return 'Today';if(x.toDateString()===y.toDateString())return 'Yesterday';
 return x.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
}
// Status emoji next to a name (hover for the text).
export function StatusMark({m}:{m?:ZMember}){
 const s=liveStatus(m);if(!s)return null;
 return <span className="zn-status-mark" title={s.text||undefined} aria-label={s.text||'status'}>{s.emoji||'💬'}</span>;
}
