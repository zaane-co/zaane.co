import {notFound} from 'next/navigation';
import BlogEditor from '@/components/admin/blog/BlogEditor';
import {postHtml} from '@/lib/blog-html';
import {blogAccess,loadCategories,type Post} from '../data';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.test(id))notFound();
 const {db,canPublish}=await blogAccess();
 const [{data:post},categories,{data:links}]=await Promise.all([
  db.from('blog_posts').select('*').eq('id',id).maybeSingle(),
  loadCategories(db),
  db.from('blog_post_categories').select('category_id').eq('post_id',id),
 ]);
 if(!post)notFound();
 const cats=links?.length?links.map(l=>l.category_id):post.category_id?[post.category_id]:[];
 return <BlogEditor key={post.id} initialData={{...post,content:postHtml(String(post.content||''))} as Post} categories={categories} initialCats={cats} canPublish={canPublish}/>;
}
