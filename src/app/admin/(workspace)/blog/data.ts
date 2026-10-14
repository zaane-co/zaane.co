import 'server-only';
import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import type {Category,Post} from '@/components/admin/blog/shared';
export async function blogAccess(){
 const user=await staff();if(!user||!allowed('blog_posts',user.role))notFound();
 return {user,db:await sessionClient(),canPublish:user.role!=='editor'};
}
export async function loadCategories(db:Awaited<ReturnType<typeof sessionClient>>){
 const {data}=await db.from('blog_categories').select('*').order('name');
 return (data??[]).map(c=>({...c,parent_id:c.parent_id??null})) as Category[];
}
export type {Post};
