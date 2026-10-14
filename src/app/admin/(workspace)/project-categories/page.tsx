import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import ProjectCategories from '@/components/admin/ProjectCategories';
export default async function Page(){
 const user=await staff();if(!user||user.role==='editor')notFound();
 const db=await sessionClient();
 const [{data:cats},{data:projects}]=await Promise.all([db.from('project_categories').select('id,kind,name'),db.from('projects').select('category,sub_category,work_category')]);
 const usage:Record<string,number>={};
 for(const p of projects??[])for(const k of ['category','sub_category','work_category'] as const)if(p[k]){const key=`${k}:${p[k]}`;usage[key]=(usage[key]??0)+1;}
 return <ProjectCategories initial={cats??[]} usage={usage}/>;
}
