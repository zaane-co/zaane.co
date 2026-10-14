import AdminComments,{type AdminComment} from '@/components/admin/blog/AdminComments';
import {blogAccess} from '../data';
export default async function Page(){
 const {db,canPublish}=await blogAccess();
 const {data}=await db.from('blog_comments').select('*,blog_posts(title,slug)').order('created_at',{ascending:false});
 return <AdminComments initialComments={(data??[]) as AdminComment[]} canModerate={canPublish}/>;
}
