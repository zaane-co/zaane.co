import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import TemplateEditor from '@/components/admin/TemplateEditor';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const user=await staff();if(!user||!allowed('newsletter',user.role))notFound();
 if(id==='new')return <TemplateEditor/>;
 if(!uuid.test(id))notFound();
 const db=await sessionClient();
 const {data}=await db.from('newsletter_templates').select('id,name,body').eq('id',id).maybeSingle();
 if(!data)notFound();
 return <TemplateEditor template={data}/>;
}
