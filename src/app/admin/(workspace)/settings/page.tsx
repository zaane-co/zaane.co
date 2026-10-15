import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import SiteSettings from '@/components/admin/SiteSettings';
import {bankColumns,type BankAccount} from '@/lib/bank';

export default async function Page(){
 const user=await staff();if(user?.role!=='super_admin')notFound();
 const db=await sessionClient();
 const [{data},{data:accounts}]=await Promise.all([db.from('settings').select('key,value'),db.from('bank_accounts').select(bankColumns).order('is_default',{ascending:false}).order('created_at')]);
 const values=Object.fromEntries((data??[]).map(r=>[r.key,r.value]));
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Settings</h1><p>Contact details, social links, invoice details and images used across zaane.co.</p></div></div>
  <SiteSettings initial={values} accounts={(accounts??[]) as BankAccount[]}/>
 </div>;
}
