import {sessionClient,staff} from '@/lib/supabase/server';
import {collections,allowed} from '@/lib/cms';
import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import Manager from '@/components/admin/Manager';
const intro:Record<string,string>={leads:'Project briefs submitted through the website.',contact_submissions:'Messages, partnership requests and applications.',subscribers:'People who joined the newsletter.',blog_posts:'Write, review and publish articles.',projects:'Case studies shown on the Work page.',project_images:'Gallery images attached to projects.',testimonials:'Approved client quotes.',team_members:'People shown on the About page.',pages_content:'Editable copy for site pages.',users:'Staff accounts and their roles.',settings:'Site-wide contact details and links.'};
export default async function Page({params,searchParams}:{params:Promise<{collection:string}>;searchParams:Promise<{page?:string}>}){
 const {collection}=await params;
 if(collection==='blog_posts')redirect('/admin/blog');if(collection==='project_images')redirect('/admin/projects');if(collection==='blog_categories')redirect('/admin/blog/categories');const user=await staff();if(!user||!allowed(collection,user.role))notFound();
 const page=Math.max(1,Number((await searchParams).page)||1);const db=await sessionClient();const {data,error,count}=await db.from(collection).select('*',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*30,page*30-1);
 const [categories,projects,taxonomy]=await Promise.all([db.from('blog_categories').select('id,name'),db.from('projects').select('id,title'),db.from('project_categories').select('kind,name').order('name')]);
 const galleryRows=collection==='projects'?(await db.from('project_images').select('id,project_id,image_url,order').order('order').order('created_at')).data??[]:[];
 const gallery=galleryRows.reduce<Record<string,{id:string;image_url:string;order:number}[]>>((m,r)=>{(m[r.project_id]??=[]).push({id:r.id,image_url:r.image_url,order:r.order});return m;},{});
 const tax=(kind:string)=>(taxonomy.data||[]).filter(r=>r.kind===kind).map(r=>({value:r.name,label:r.name}));
 const spec=collections[collection];
 return <div className="za-page">
  <div className="za-page-head"><div><h1>{spec.label}</h1><p>{intro[collection]||`Manage ${spec.label.toLowerCase()}.`}</p></div><span className="za-date">{count??0} record{count===1?'':'s'}</span></div>
  {error?<div className="za-notice" role="alert">Could not load this collection. Check that the Supabase migration is applied.</div>:<Manager gallery={gallery} key={`${collection}-${page}`} collection={collection} rows={data||[]} role={user.role} options={{category_id:(categories.data||[]).map(r=>({value:r.id,label:r.name})),project_id:(projects.data||[]).map(r=>({value:r.id,label:r.title})),category:tax('category'),sub_category:tax('sub_category'),work_category:tax('work_category')}}/>}
  {(count||0)>30&&<div className="za-pager">{page>1?<Link className="za-btn za-btn-ghost" href={`?page=${page-1}`}>Previous</Link>:<span/>}<span>Page {page} of {Math.ceil((count||0)/30)}</span>{(count||0)>page*30?<Link className="za-btn za-btn-ghost" href={`?page=${page+1}`}>Next</Link>:<span/>}</div>}
 </div>;
}
