'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,Pencil,X} from 'lucide-react';
import {t} from './blog/shared';

type Cat={id:string;kind:string;name:string};
const groups=[
 {kind:'category',title:'Categories',hint:'Top level, e.g. Design or Development.',placeholder:'e.g. Strategy'},
 {kind:'sub_category',title:'Subcategories',hint:'Shown as filter tabs on the public Work page.',placeholder:'e.g. Motion Design'},
 {kind:'work_category',title:'Selected work tabs',hint:'Used to group projects in the selected-work section.',placeholder:'e.g. Packaging'},
];
async function api(body:object){const r=await fetch('/api/admin/project-categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;}

export default function ProjectCategories({initial,usage}:{initial:Cat[];usage:Record<string,number>}){
 const router=useRouter();
 const [cats,setCats]=useState(initial);
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [editing,setEditing]=useState<string|null>(null),[editName,setEditName]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();router.refresh();}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}setBusy(false);}
 const add=(kind:string)=>run(async()=>{const name=(drafts[kind]||'').trim();if(!name)return;const row=await api({action:'create',kind,name});setCats(c=>[...c,row]);setDrafts(d=>({...d,[kind]:''}));});
 const rename=(c:Cat)=>run(async()=>{const row=await api({action:'rename',id:c.id,name:editName});setCats(list=>list.map(x=>x.id===c.id?row:x));setEditing(null);});
 const remove=(c:Cat)=>run(async()=>{await api({action:'delete',id:c.id});setCats(list=>list.filter(x=>x.id!==c.id));});

 return <div className="w-full">
  <div className="mb-6"><h1 className={`text-xl font-bold ${t.heading}`}>Project Categories</h1><p className={`text-sm mt-0.5 ${t.sub}`}>Create the options you pick from when adding a project. You can also create one straight from a project’s dropdown.</p></div>
  {error&&<div className="mb-4 rounded-lg bg-[#dc2626] px-4 py-3 text-xs text-white">{error}</div>}
  <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
   {groups.map(g=>{const list=cats.filter(c=>c.kind===g.kind).sort((a,b)=>a.name.localeCompare(b.name));return <div key={g.kind} className={`rounded-xl border overflow-hidden self-start ${t.card}`}>
    <div className={`px-5 py-4 border-b ${t.divider}`}><p className={`text-xs font-semibold uppercase tracking-wide ${t.sub}`}>{g.title} <span className={t.faint}>· {list.length}</span></p><p className={`text-xs mt-1 ${t.faint}`}>{g.hint}</p></div>
    <div className={`flex items-center gap-2 px-5 py-3 border-b ${t.divider}`}>
     <input value={drafts[g.kind]||''} onChange={e=>setDrafts(d=>({...d,[g.kind]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&add(g.kind)} maxLength={80} placeholder={g.placeholder} className={`flex-1 min-w-0 rounded-lg border px-3 py-2 text-xs focus:outline-none transition-colors ${t.input}`}/>
     <button onClick={()=>add(g.kind)} disabled={busy||!(drafts[g.kind]||'').trim()} className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${t.brandBtn}`}>Add</button>
    </div>
    {list.length===0?<p className={`py-10 text-center text-sm ${t.sub}`}>Nothing yet.</p>:<div className="divide-y divide-[var(--a-border)]">
     {list.map(c=><div key={c.id} className="flex items-center gap-2 px-5 py-2.5 transition-colors hover:bg-[var(--a-hover)]">
      {editing===c.id?<>
       <input autoFocus value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')rename(c);if(e.key==='Escape')setEditing(null);}} maxLength={80} className={`flex-1 min-w-0 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none ${t.input}`}/>
       <button onClick={()=>rename(c)} disabled={busy||!editName.trim()} aria-label="Save" data-tip="Save" className="h-6 w-6 rounded flex items-center justify-center bg-[#16a34a] text-white disabled:opacity-40"><Check className="h-3.5 w-3.5"/></button>
       <button onClick={()=>setEditing(null)} aria-label="Cancel" data-tip="Cancel" className={`h-6 w-6 rounded flex items-center justify-center ${t.iconBtn}`}><X className="h-3.5 w-3.5"/></button>
      </>:<>
       <span className={`flex-1 text-sm ${t.heading}`}>{c.name}</span>
       {usage[`${c.kind}:${c.name}`]?<span className={`text-xs rounded-full px-2 py-0.5 ${t.soft} ${t.faint}`}>{usage[`${c.kind}:${c.name}`]} project{usage[`${c.kind}:${c.name}`]>1?'s':''}</span>:null}
       <button onClick={()=>{setEditing(c.id);setEditName(c.name);}} aria-label={`Rename ${c.name}`} data-tip={`Rename ${c.name}`} className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${t.iconBtn}`}><Pencil className="h-3 w-3"/></button>
       <button onClick={()=>remove(c)} disabled={busy} aria-label={`Delete ${c.name}`} data-tip={`Delete ${c.name}`} className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${t.faint} hover:text-white hover:bg-[#dc2626]`}><X className="h-3.5 w-3.5"/></button>
      </>}
     </div>)}
    </div>}
   </div>;})}
  </div>
 </div>;
}
