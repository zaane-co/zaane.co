import BlogCategories from '@/components/admin/blog/BlogCategories';
import {blogAccess,loadCategories} from '../data';
export default async function Page(){
 const {db,canPublish}=await blogAccess();
 return <BlogCategories initial={await loadCategories(db)} canManage={canPublish}/>;
}
