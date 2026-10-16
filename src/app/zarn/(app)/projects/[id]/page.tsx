import ProjectBoard from '@/components/zarn/ProjectBoard';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return <ProjectBoard key={id} id={id}/>;
}
