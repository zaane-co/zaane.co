import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import SiteSettings from '@/components/admin/SiteSettings';

export default async function Page(){
 const user=await staff();if(user?.role!=='super_admin')notFound();
 const {data}=await (await sessionClient()).from('settings').select('key,value');
 const values=Object.fromEntries((data??[]).map(r=>[r.key,r.value]));
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Settings</h1><p>Contact details, social links, invoice details and images used across zaane.co.</p></div></div>
  <SiteSettings initial={values}/>
 </div>;
}
