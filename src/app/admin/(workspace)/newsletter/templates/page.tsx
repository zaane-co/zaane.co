import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import TemplateList from '@/components/admin/TemplateList';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await staff();if(!user||!allowed('newsletter',user.role))notFound();
 const db=await sessionClient();
 const {data,error}=await db.from('newsletter_templates').select('id,name,body,updated_at').order('created_at',{ascending:true}).limit(200);
 if(error)return <div className="za-page"><div className="za-page-head"><div><h1>Templates</h1></div></div><div className="za-notice" role="alert">Could not load templates. Check that the 202610150013 migration is applied.</div></div>;
 return <TemplateList templates={data??[]}/>;
}
