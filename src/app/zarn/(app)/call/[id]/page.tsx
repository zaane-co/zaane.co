import {JoinCallPage} from '@/components/zarn/CallProvider';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <JoinCallPage key={id} id={id}/>;}
