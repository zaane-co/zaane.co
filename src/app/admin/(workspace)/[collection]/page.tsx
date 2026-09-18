import {sessionClient,staff} from '@/lib/supabase/server';
import {collections,allowed} from '@/lib/cms';
import {notFound} from 'next/navigation';
import Manager from '@/components/admin/Manager';
export default async function Page({params,searchParams}:{params:Promise<{collection:string}>;searchParams:Promise<{page?:string}>}){
 const {collection}=await params;const user=await staff();if(!user||!allowed(collection,user.role))notFound();
 const page=Math.max(1,Number((await searchParams).page)||1);const db=await sessionClient();const {data,error,count}=await db.from(collection).select('*',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*30,page*30-1);
 const [categories,projects]=await Promise.all([db.from('blog_categories').select('id,name'),db.from('projects').select('id,title')]);
 return <><span className="eyebrow">Studio workspace</span><h1>{collections[collection].label}</h1>{error?<div className="notice" role="alert">Could not load this collection. Check that the Supabase migration is applied.</div>:<Manager key={`${collection}-${page}`} collection={collection} rows={data||[]} role={user.role} options={{category_id:(categories.data||[]).map(r=>({value:r.id,label:r.name})),project_id:(projects.data||[]).map(r=>({value:r.id,label:r.title}))}}/>}<div className="pagination">{page>1&&<a href={`?page=${page-1}`}>← Previous</a>}<span>Page {page} · {count??0} records</span>{(count||0)>page*30&&<a href={`?page=${page+1}`}>Next →</a>}</div></>;
}
