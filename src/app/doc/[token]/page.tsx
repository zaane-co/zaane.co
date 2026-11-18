import {evaluate,parseRef,readSheet,ref,show} from '@/lib/sheet';
import {notFound} from 'next/navigation';
import {cookies} from 'next/headers';
import type {Metadata} from 'next';
import {serviceClient} from '@/lib/supabase/server';
import {cleanDocHtml as cleanHtml} from '@/lib/blog-html';
import {cookieName,verifyUnlock} from '@/lib/doc-share';
import DocUnlock from './DocUnlock';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Shared document | Zaane',robots:{index:false,follow:false}};
// A document shared by link. Read only. If the link has a password it is asked for first; the link can expire or be revoked.
export default async function Page({params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!/^[A-Za-z0-9_-]{20,60}$/.test(token))notFound();
 const db=serviceClient();
 const {data:l}=await db.from('zarn_doc_links').select('id,doc_id,password_hash,expires_at,revoked_at,views').eq('token',token).maybeSingle();
 if(!l||l.revoked_at||(l.expires_at&&new Date(l.expires_at)<new Date()))return <main className="docpub"><div className="docpub-card"><h1>This link isn’t available</h1><p>It may have expired or been turned off. Ask the person who sent it for a new one.</p></div></main>;
 if(l.password_hash&&!verifyUnlock(token,(await cookies()).get(cookieName(token))?.value))return <main className="docpub"><DocUnlock token={token}/></main>;
 const {data:doc}=await db.from('zarn_docs').select('title,content,updated_at,kind,trashed_at').eq('id',l.doc_id).maybeSingle();
 if(!doc||doc.trashed_at)notFound();
 await db.from('zarn_doc_links').update({views:l.views+1}).eq('id',l.id);
 return <main className="docpub"><article className="docpub-doc">
  <h1>{doc.title||'Untitled'}</h1>
  {doc.kind==='sheet'?<SheetView raw={doc.content}/>:<div className="docpub-body" dangerouslySetInnerHTML={{__html:cleanHtml(doc.content).replaceAll('/api/zarn/editor-image?k=',`/api/zarn/editor-image?t=${token}&k=`)}}/>}
  <footer>Shared from Zaane · updated {new Date(doc.updated_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</footer>
 </article></main>;
}

// Read-only sheet: each tab's used area with formulas worked out.
function SheetView({raw}:{raw:string}){
 const data=readSheet(raw);
 return <>{data.tabs.map(t=>{const v=evaluate(t,data.tabs);let mc=0,mr=0;for(const k of Object.keys(t.cells)){const p=parseRef(k);if(p){mc=Math.max(mc,p[0]);mr=Math.max(mr,p[1]);}}
  return <section key={t.id} className="docpub-sheet">{data.tabs.length>1&&<h2>{t.name}</h2>}<div className="docpub-sheet-scroll"><table><tbody>{Array.from({length:mr+1},(_,r)=><tr key={r}>{Array.from({length:mc+1},(_,c)=>{const k=ref(c,r);const st=t.style?.[k];return <td key={c} style={{fontWeight:st?.b?700:undefined,fontStyle:st?.i?'italic':undefined,textDecoration:[st?.u?'underline':'',st?.s?'line-through':''].join(' ').trim()||undefined,color:st?.color,background:st?.bg,textAlign:st?.h==='c'?'center':st?.h==='r'?'right':undefined}}>{show(v[k],st)}</td>;})}</tr>)}</tbody></table></div></section>;})}</>;
}
