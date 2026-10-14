import BlogEditor from '@/components/admin/blog/BlogEditor';
import {blogAccess,loadCategories} from '../data';
export default async function Page(){
 const {db,canPublish}=await blogAccess();
 return <BlogEditor categories={await loadCategories(db)} canPublish={canPublish}/>;
}
