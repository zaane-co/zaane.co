import type {Metadata} from 'next';
import {serviceClient} from '@/lib/supabase/server';
import UnsubscribeButton from './UnsubscribeButton';
export const metadata:Metadata={title:'Unsubscribe | Zaane',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({searchParams}:{searchParams:Promise<{t?:string}>}){
 const {t=''}=await searchParams;
 let state:'invalid'|'active'|'done'='invalid';
 if(uuid.test(t)){
  const {data}=await serviceClient().from('subscribers').select('unsubscribed_at').eq('unsubscribe_token',t).maybeSingle();
  if(data)state=data.unsubscribed_at?'done':'active';
 }
 return <section className="content-section"><div className="content-heading"><h1 style={{fontSize:'clamp(32px,4vw,56px)',fontWeight:500,letterSpacing:'-.05em'}}>{state==='done'?'You’re unsubscribed':state==='active'?'Unsubscribe from our newsletter':'This link isn’t valid'}</h1></div>
  {state==='active'&&<><p>You’ll stop getting emails from the Zaane newsletter. You can rejoin any time from our Resources page.</p><UnsubscribeButton token={t}/></>}
  {state==='done'&&<p>You won’t get any more newsletter emails from us.</p>}
  {state==='invalid'&&<p>The unsubscribe link is incomplete or has expired. Reply to any newsletter email and we’ll remove you by hand.</p>}
 </section>;
}
