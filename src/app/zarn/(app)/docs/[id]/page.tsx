import DocPage from '@/components/zarn/DocPage';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <DocPage key={id} id={id}/>;}
