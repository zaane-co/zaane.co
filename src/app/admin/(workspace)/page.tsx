import {sessionClient,staff} from '@/lib/supabase/server';
import Link from 'next/link';
import {BookOpen,Briefcase,Inbox,Mail,Quote,Sparkles,type LucideIcon} from 'lucide-react';
import {Status,when} from '@/components/admin/ui';

type Row=Record<string,string|null>;
type Stat={label:string;value:number|string;href:string;icon:LucideIcon};

async function count(table:string,filter?:[string,string]){const db=await sessionClient();let q=db.from(table).select('id',{count:'exact',head:true});if(filter)q=q.eq(filter[0],filter[1]);const {count:c,error}=await q;return error?'-':c??0;}
async function latest(table:string,cols:string,n=5){const db=await sessionClient();const {data}=await db.from(table).select(cols).order('created_at',{ascending:false}).limit(n);return (data||[]) as unknown as Row[];}

export default async function Page(){
 const user=await staff();const editor=user?.role==='editor';
 const stats:Stat[]=editor?[
  {label:'Blog posts',value:await count('blog_posts'),href:'/admin/blog_posts',icon:BookOpen},
  {label:'In review',value:await count('blog_posts',['status','review']),href:'/admin/blog_posts',icon:Sparkles},
  {label:'Projects',value:await count('projects'),href:'/admin/projects',icon:Briefcase},
  {label:'Testimonials',value:await count('testimonials'),href:'/admin/testimonials',icon:Quote},
 ]:[
  {label:'New leads',value:await count('leads',['status','new']),href:'/admin/leads',icon:Inbox},
  {label:'Total leads',value:await count('leads'),href:'/admin/leads',icon:Sparkles},
  {label:'Contacts',value:await count('contact_submissions'),href:'/admin/contact_submissions',icon:Mail},
  {label:'Published projects',value:await count('projects',['status','published']),href:'/admin/projects',icon:Briefcase},
 ];
 const [leads,contacts,posts,projects]=await Promise.all([
  editor?[]:latest('leads','id,name,email,service_interested,status,created_at'),
  editor?[]:latest('contact_submissions','id,name,email,subject,status,created_at'),
  latest('blog_posts','id,title,slug,status,created_at'),
  latest('projects','id,title,category,status,created_at'),
 ]);
 const today=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Dashboard</h1><p>Here’s everything happening across the studio.</p></div><span className="za-date">{today}</span></div>
  <div className="za-stats">{stats.map(s=><Link key={s.label} href={s.href} className="za-card za-stat"><span className="za-stat-icon"><s.icon size={19} strokeWidth={1.8}/></span><div><p>{s.label}</p><strong>{s.value}</strong></div></Link>)}</div>
  {!editor&&<div className="za-grid-2">
   <Panel title="Latest leads" href="/admin/leads" empty="No leads yet. Project briefs from the website land here." rows={leads} cols={[['Name',r=><><b>{r.name}</b><small>{r.email}</small></>],['Service',r=>r.service_interested],['Status',r=><Status value={r.status}/>]]}/>
   <Panel title="Recent contacts" href="/admin/contact_submissions" empty="No messages yet." rows={contacts} cols={[['Name',r=><><b>{r.name}</b><small>{r.email}</small></>],['Subject',r=>r.subject],['Status',r=><Status value={r.status}/>]]}/>
  </div>}
  <div className="za-grid-2">
   <Panel title="Recent blog posts" href="/admin/blog_posts" empty="No articles yet." rows={posts} cols={[['Title',r=><><b>{r.title}</b><small>/{r.slug}</small></>],['Created',r=>when(r.created_at)],['Status',r=><Status value={r.status}/>]]}/>
   <Panel title="Recent projects" href="/admin/projects" empty="No projects yet." rows={projects} cols={[['Title',r=><b>{r.title}</b>],['Category',r=>r.category],['Status',r=><Status value={r.status}/>]]}/>
  </div>
 </div>;
}

function Panel({title,href,rows,cols,empty}:{title:string;href:string;rows:Row[];cols:[string,(r:Row)=>React.ReactNode][];empty:string}){
 return <section className="za-card">
  <div className="za-card-head"><h2>{title}</h2><Link href={href}>View all</Link></div>
  {rows.length?<div className="za-table-wrap"><table className="za-table"><thead><tr>{cols.map(([h])=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}>{cols.map(([h,f])=><td key={h}>{f(r)}</td>)}</tr>)}</tbody></table></div>:<p className="za-empty">{empty}</p>}
 </section>;
}
