import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import CampaignEditor from '@/components/admin/CampaignEditor';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{template?:string}>}){
 const {id}=await params;const {template}=await searchParams;
 const user=await staff();if(!user||!allowed('newsletter',user.role))notFound();
 const db=await sessionClient();
 const [{count},{data:templates}]=await Promise.all([db.from('subscribers').select('id',{count:'exact',head:true}).is('unsubscribed_at',null),db.from('newsletter_templates').select('id,name,body').order('created_at',{ascending:true})]);
 const tpls=templates??[];
 if(id==='new')return <CampaignEditor audience={count??0} templates={tpls} startBody={tpls.find(t=>t.id===template)?.body}/>;
 if(!uuid.test(id))notFound();
 const {data}=await db.from('newsletter_campaigns').select('id,subject,body,status,recipient_count,sent_count,failed_count,sent_at').eq('id',id).maybeSingle();
 if(!data)notFound();
 return <CampaignEditor audience={count??0} templates={tpls} campaign={data}/>;
}
