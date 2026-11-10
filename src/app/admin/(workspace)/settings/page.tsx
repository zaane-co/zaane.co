import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import SiteSettings from '@/components/admin/SiteSettings';
import {bankColumns,type BankAccount} from '@/lib/bank';

export default async function Page(){
 const user=await staff();if(user?.role!=='super_admin'&&user?.role!=='dev')notFound();
 // Dev edits site settings but never invoice or bank details.
 const money=user.role==='super_admin';
 const db=await sessionClient();
 const [{data},{data:accounts}]=await Promise.all([db.from('settings').select('key,value'),money?db.from('bank_accounts').select(bankColumns).order('is_default',{ascending:false}).order('created_at'):Promise.resolve({data:[]})]);
 const values=Object.fromEntries((data??[]).filter(r=>money||!r.key.startsWith('invoice')).map(r=>[r.key,r.value]));
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Settings</h1><p>Contact details, social links, invoice details and images used across zaane.co.</p></div></div>
  <SiteSettings money={money} initial={values} accounts={(accounts??[]) as BankAccount[]}/>
 </div>;
}
