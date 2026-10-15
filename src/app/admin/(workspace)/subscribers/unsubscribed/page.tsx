import {notFound} from 'next/navigation';
import {UserMinus} from 'lucide-react';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {when} from '@/components/admin/ui';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await staff();if(!user||!allowed('subscribers',user.role))notFound();
 const db=await sessionClient();
 const {data,error}=await db.from('subscribers').select('id,email,created_at,unsubscribed_at').not('unsubscribed_at','is',null).order('unsubscribed_at',{ascending:false}).limit(1000);
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Unsubscribed</h1><p>People who opted out. They never get campaigns, and joining again from the site re-subscribes them.</p></div><span className="za-date">{data?.length??0} record{data?.length===1?'':'s'}</span></div>
  {error?<div className="za-notice" role="alert">Could not load this list. Check that the 202610150011 migration is applied.</div>:
  <section className="za-card">{data?.length?<div className="za-table-wrap"><table className="za-table">
   <thead><tr><th>Email</th><th className="za-hide-sm">Joined</th><th>Unsubscribed</th></tr></thead>
   <tbody>{data.map(s=><tr key={s.id}><td>{s.email}</td><td className="za-hide-sm za-cell-muted">{when(s.created_at)}</td><td className="za-cell-muted">{when(s.unsubscribed_at)}</td></tr>)}</tbody></table></div>:<div className="za-empty za-empty-lg"><UserMinus size={28}/><h3>No one has unsubscribed</h3><p>People who opt out will show up here.</p></div>}</section>}
 </div>;
}
