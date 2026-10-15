import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Plus,Send} from 'lucide-react';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {Status,when} from '@/components/admin/ui';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await staff();if(!user||!allowed('newsletter',user.role))notFound();
 const db=await sessionClient();
 const [{data,error},{count}]=await Promise.all([
  db.from('newsletter_campaigns').select('id,subject,status,recipient_count,sent_count,failed_count,sent_at,created_at').order('created_at',{ascending:false}).limit(200),
  db.from('subscribers').select('id',{count:'exact',head:true}).is('unsubscribed_at',null),
 ]);
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Campaigns</h1><p>Write an email and send it to the {count??0} {count===1?'person':'people'} still subscribed.</p></div>
   <div className="za-toolbar-actions"><Link className="za-btn za-btn-primary" href="/admin/newsletter/new"><Plus size={15}/>New campaign</Link></div></div>
  {error?<div className="za-notice" role="alert">Could not load campaigns. Check that the 202610150011 migration is applied.</div>:
  <section className="za-card">{data?.length?<div className="za-table-wrap"><table className="za-table za-table-click">
   <thead><tr><th>Subject</th><th>Status</th><th className="za-hide-sm">Delivered</th><th className="za-hide-sm">Date</th></tr></thead>
   <tbody>{data.map(c=><tr key={c.id}>
    <td><Link href={`/admin/newsletter/${c.id}`} className="za-cell-main"><span><b>{c.subject||'Untitled draft'}</b></span></Link></td>
    <td><Status value={c.status==='sending'?'in_progress':c.status}/></td>
    <td className="za-hide-sm">{c.status==='draft'?'-':`${c.sent_count} of ${c.recipient_count}${c.failed_count?` (${c.failed_count} failed)`:''}`}</td>
    <td className="za-hide-sm za-cell-muted">{when(c.sent_at||c.created_at)}</td>
   </tr>)}</tbody></table></div>:<div className="za-empty za-empty-lg"><Send size={28}/><h3>No campaigns yet</h3><p>Write your first email to your subscribers.</p></div>}</section>}
 </div>;
}
