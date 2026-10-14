import {notFound} from 'next/navigation';
import CuratedLinks,{type Curated} from '@/components/admin/blog/CuratedLinks';
import {blogAccess} from '../data';
export default async function Page(){
 const {db,canPublish}=await blogAccess();if(!canPublish)notFound();
 const {data}=await db.from('blog_curated').select('*').order('created_at',{ascending:false});
 return <CuratedLinks initialLinks={(data??[]) as Curated[]}/>;
}
