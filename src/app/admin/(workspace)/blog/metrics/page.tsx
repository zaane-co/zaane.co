import PostMetrics,{type MetricPost} from '@/components/admin/blog/PostMetrics';
import {blogAccess} from '../data';
const tally=(rows:{post_id:string}[]|null)=>(rows??[]).reduce<Record<string,number>>((m,r)=>{m[r.post_id]=(m[r.post_id]??0)+1;return m;},{});
export default async function Page(){
 const {db}=await blogAccess();
 const [{data:posts},{data:views},{data:likes},{data:comments}]=await Promise.all([
  db.from('blog_posts').select('id,title,slug,status,published_at,cover_image').order('published_at',{ascending:false,nullsFirst:false}),
  db.from('blog_post_views').select('post_id,read_duration_seconds'),
  db.from('blog_likes').select('post_id'),
  db.from('blog_comments').select('post_id,approved'),
 ]);
 const viewCount=tally(views),likeCount=tally(likes),commentCount=tally(comments),pendingCount=tally((comments??[]).filter(c=>!c.approved));
 const reads=(views??[]).reduce<Record<string,number[]>>((m,v)=>{if(v.read_duration_seconds!=null)(m[v.post_id]??=[]).push(v.read_duration_seconds);return m;},{});
 const enriched:MetricPost[]=(posts??[]).map(p=>({...p,views:viewCount[p.id]??0,likes:likeCount[p.id]??0,comments:commentCount[p.id]??0,pending_comments:pendingCount[p.id]??0,avg_read_secs:reads[p.id]?Math.round(reads[p.id].reduce((a,b)=>a+b,0)/reads[p.id].length):null}));
 return <PostMetrics posts={enriched}/>;
}
