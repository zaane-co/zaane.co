import {Suspense} from 'react';
import FormPage from '@/components/zarn/FormPage';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Suspense><FormPage key={id} id={id}/></Suspense>;}
