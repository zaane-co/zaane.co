import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {readForm} from '@/lib/form';
import FormFill from '@/components/zarn/FormFill';
import '@/components/zarn/form.css';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function load(id:string){
 if(!UUID.test(id))return null;
 const {data}=await serviceClient().from('zarn_docs').select('id,title,kind,content,trashed_at').eq('id',id).maybeSingle();
 return data&&data.kind==='form'&&!data.trashed_at?data:null;
}
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const d=await load((await params).id);
 return {title:d?.title||'Form',robots:{index:false,follow:false},openGraph:d?{title:d.title||'Form',description:readForm(d.content).desc.slice(0,160)||'Fill out this form'}:undefined};
}
// A ZARN form, answered by link. Team forms need a ZARN sign-in; public ones take answers from anyone.
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const d=await load(id);if(!d)notFound();
 const f=readForm(d.content);
 const note=(h:string,p:React.ReactNode)=><main className="zff" style={{'--zff':f.set.color||'#673ab7'} as React.CSSProperties}><div className="zff-wrap"><div className="zff-card zff-head"><h1>{d.title||'Untitled form'}</h1><p className="zff-desc"><b>{h}</b></p><p className="zff-desc">{p}</p></div></div></main>;
 if(!f.set.open)return note('This form is no longer accepting responses','Try contacting the owner of the form if you think this is a mistake.');
 const me=await zarnMember().catch(()=>null);
 if(f.set.who==='team'&&(!me||me.account_type!=='member'))return note('Only the team can answer this form',<>Sign in to <a href="/zarn/login">ZARN</a>, then open this link again.</>);
 if(f.set.once&&me){const {count}=await serviceClient().from('zarn_form_responses').select('id',{count:'exact',head:true}).eq('doc_id',id).eq('user_id',me.user_id);
  if(count)return note('You’ve already responded','You can fill out this form only once.');}
 return <main><FormFill id={id} title={d.title} form={f} who={me?.display_name??null}/></main>;
}
