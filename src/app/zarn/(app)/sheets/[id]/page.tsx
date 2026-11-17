import SheetPage from '@/components/zarn/SheetPage';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <SheetPage key={id} id={id}/>;}
