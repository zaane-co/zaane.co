import BlogArchives from '@/components/admin/blog/BlogArchives';
import {blogAccess,type Post} from '../data';
export default async function Page(){
 const {db}=await blogAccess();
 const {data}=await db.from('blog_posts').select('id,title,slug,excerpt,status,published_at,created_at').order('created_at',{ascending:false});
 return <BlogArchives posts={(data??[]) as Post[]}/>;
}
