'use client';
import {useEffect} from 'react';
import {Printer} from 'lucide-react';
// auto opens the print dialog once the page has rendered (used by the editor's Print button).
export default function PrintButton({auto}:{auto?:boolean}){
 useEffect(()=>{if(auto){const t=setTimeout(()=>window.print(),400);return()=>clearTimeout(t);}},[auto]);
 return <button type="button" onClick={()=>window.print()}><Printer size={16}/>Print or save as PDF</button>;
}
