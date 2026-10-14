import BlogList from '@/components/admin/blog/BlogList';
import {blogAccess,loadCategories,type Post} from './data';
export default async function Page(){
 const {db,canPublish}=await blogAccess();
 const [{data:posts},categories,{data:postCats},{data:views}]=await Promise.all([
  db.from('blog_posts').select('*').order('created_at',{ascending:false}),
  loadCategories(db),
  db.from('blog_post_categories').select('post_id,category_id'),
  db.from('blog_post_views').select('post_id'),
 ]);
 const viewCounts=Object.entries((views??[]).reduce<Record<string,number>>((m,v)=>{m[v.post_id]=(m[v.post_id]??0)+1;return m;},{})).map(([post_id,n])=>({post_id,views:n}));
 // Fall back to the single category_id for posts with no category links yet.
 const links=postCats??(posts??[]).filter(p=>p.category_id).map(p=>({post_id:p.id,category_id:p.category_id}));
 return <BlogList posts={(posts??[]) as Post[]} categories={categories} postCats={links} viewCounts={viewCounts} canPublish={canPublish}/>;
}
