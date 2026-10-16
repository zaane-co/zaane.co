import {notFound} from 'next/navigation';
import {cookies} from 'next/headers';
import type {Metadata} from 'next';
import {serviceClient} from '@/lib/supabase/server';
import {cleanHtml} from '@/lib/blog-html';
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
 const {data:doc}=await db.from('zarn_docs').select('title,content,updated_at').eq('id',l.doc_id).maybeSingle();
 if(!doc)notFound();
 void db.from('zarn_doc_links').update({views:l.views+1}).eq('id',l.id);
 return <main className="docpub"><article className="docpub-doc">
  <h1>{doc.title||'Untitled'}</h1>
  <div className="docpub-body" dangerouslySetInnerHTML={{__html:cleanHtml(doc.content).replaceAll('/api/zarn/editor-image?k=',`/api/zarn/editor-image?t=${token}&k=`)}}/>
  <footer>Shared from Zaane · updated {new Date(doc.updated_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</footer>
 </article></main>;
}
