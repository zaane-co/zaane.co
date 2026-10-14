'use client';
import {NodeViewWrapper,type NodeViewProps} from '@tiptap/react';
import {useRef,useState} from 'react';
import {ImageIcon,Loader2,X} from 'lucide-react';
import {uploadImage} from './shared';

export function EditorImageView({node,deleteNode,updateAttributes}:NodeViewProps){
 const [hovered,setHovered]=useState(false);
 const [replacing,setReplacing]=useState(false);
 const fileRef=useRef<HTMLInputElement>(null);
 const src:string=node.attrs.src??'';
 const width:string|undefined=node.attrs.width;

 async function handleReplaceFile(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file)return;
  setReplacing(true);
  try{updateAttributes({src:await uploadImage(file)});}catch{}
  setReplacing(false);if(fileRef.current)fileRef.current.value='';
 }

 return <NodeViewWrapper className="relative inline-block group my-4 w-full">
  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceFile}/>
  <img src={src} alt={node.attrs.alt??''} style={{width:width??'100%'}} className="rounded-xl max-w-full block" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}/>
  {(hovered||replacing)&&<div className="absolute top-3 right-3 flex items-center gap-1.5" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
   <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-black text-white text-xs px-2.5 py-1.5 hover:bg-[#222] transition-colors">
    {replacing?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<ImageIcon className="h-3.5 w-3.5"/>}Replace
   </button>
   <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>deleteNode()} className="flex items-center justify-center h-7 w-7 rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors" aria-label="Remove image" data-tip="Remove image"><X className="h-3.5 w-3.5" strokeWidth={2.5}/></button>
  </div>}
 </NodeViewWrapper>;
}
