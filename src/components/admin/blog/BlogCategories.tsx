'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ChevronRight,Search,X} from 'lucide-react';
import {t,blogApi,type Category} from './shared';

export default function BlogCategories({initial,canManage}:{initial:Category[];canManage:boolean}){
 const router=useRouter();
 const [categories,setCategories]=useState<Category[]>(initial);
 const [newName,setNewName]=useState('');
 const [adding,setAdding]=useState(false);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [subForm,setSubForm]=useState<Record<string,string>>({});
 const [addingSub,setAddingSub]=useState<Record<string,boolean>>({});
 const [expandedSub,setExpandedSub]=useState<Record<string,boolean>>({});

 const allParents=categories.filter(c=>!c.parent_id);
 const q=search.toLowerCase();
 const parents=search?allParents.filter(c=>c.name.toLowerCase().includes(q)||categories.some(s=>s.parent_id===c.id&&s.name.toLowerCase().includes(q))):allParents;
 const children=(id:string)=>categories.filter(c=>c.parent_id===id);

 async function addCategory(name:string,parentId?:string){
  if(!name.trim())return;
  if(parentId)setAddingSub(p=>({...p,[parentId]:true}));else setAdding(true);
  setError('');
  try{
   const data=await blogApi<Category>({action:'category',name:name.trim(),parent_id:parentId??null});
   setCategories(prev=>[...prev,data]);
   if(parentId){setSubForm(p=>({...p,[parentId]:''}));setExpandedSub(p=>({...p,[parentId]:true}));}else setNewName('');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Failed to add.');}
  if(parentId)setAddingSub(p=>({...p,[parentId]:false}));else setAdding(false);
 }
 async function deleteCategory(id:string){
  const prev=categories;
  setCategories(c=>c.filter(x=>x.id!==id&&x.parent_id!==id));
  try{await blogApi({action:'delete_category',id});router.refresh();}catch(e){setCategories(prev);setError(e instanceof Error?e.message:'Could not delete.');}
 }
 const del=(id:string,name:string)=>canManage&&<button onClick={()=>deleteCategory(id)} aria-label={`Delete ${name}`} data-tip={`Delete ${name}`} className={`h-6 w-6 rounded flex items-center justify-center flex-none transition-colors ${t.faint} hover:text-white hover:bg-[#dc2626]`}><X className="h-3.5 w-3.5"/></button>;

 return <div className="w-full">
  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
   <div><h1 className={`text-xl font-bold ${t.heading}`}>Categories</h1><p className={`text-sm mt-0.5 ${t.sub}`}>{allParents.length} parent · {categories.filter(c=>c.parent_id).length} sub</p></div>
   <div className="relative w-52">
    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.sub}`}/>
    <input type="text" placeholder="Search categories…" value={search} onChange={e=>setSearch(e.target.value)} className={`w-full rounded-lg border pl-9 pr-3 py-2 text-xs focus:outline-none transition-colors ${t.input}`}/>
    {search&&<button onClick={()=>setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.sub} hover:opacity-70`} aria-label="Clear search" data-tip="Clear search"><X className="h-3 w-3"/></button>}
   </div>
  </div>
  {error&&<div className="mb-4 rounded-lg bg-[#dc2626] px-4 py-3 text-xs text-white">{error}</div>}

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
   <div className="space-y-4">
    {canManage&&<div className={`rounded-xl border p-5 space-y-4 ${t.card}`}>
     <p className={`text-xs font-semibold uppercase tracking-wide ${t.sub}`}>New Category</p>
     <input type="text" placeholder="e.g. Product Design" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCategory(newName)} className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none transition-colors ${t.input}`}/>
     <button onClick={()=>addCategory(newName)} disabled={adding||!newName.trim()} className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${t.brandBtn}`}>{adding?'Adding…':'Add Category'}</button>
    </div>}
    <div className="rounded-xl border border-dashed p-5 space-y-1 border-[var(--a-border)]">
     <p className={`text-xs font-semibold ${t.sub}`}>How categories work</p>
     <p className={`text-xs leading-relaxed ${t.faint}`}>Add parent categories first. Then expand any parent to add subcategories beneath it. When writing a post you can assign one or more categories and subcategories.</p>
    </div>
   </div>

   <div className={`rounded-xl border overflow-hidden ${t.card}`}>
    <div className={`px-5 py-4 border-b ${t.divider}`}><p className={`text-xs font-semibold uppercase tracking-wide ${t.sub}`}>All Categories</p></div>
    {parents.length===0?<div className={`py-12 text-center text-sm ${t.sub}`}>{search?'No matching categories.':'No categories yet. Add your first one.'}</div>:
    <div className="divide-y divide-[var(--a-border)]">
     {parents.map(cat=>{const subs=children(cat.id),open=expandedSub[cat.id];return <div key={cat.id}>
      <div className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--a-hover)]">
       <button onClick={()=>setExpandedSub(p=>({...p,[cat.id]:!p[cat.id]}))} aria-label={open?'Collapse':'Expand'} className={`h-5 w-5 rounded flex items-center justify-center flex-none transition-colors ${t.faint} hover:text-[var(--a-fg)]`}><ChevronRight className={`h-3 w-3 transition-transform ${open?'rotate-90':''}`} strokeWidth={2.5}/></button>
       <span className={`flex-1 text-sm font-medium ${t.heading}`}>{cat.name}</span>
       {subs.length>0&&<span className={`text-xs rounded-full px-2 py-0.5 ${t.soft} ${t.faint}`}>{subs.length}</span>}
       {del(cat.id,cat.name)}
      </div>
      {open&&<div className={`border-t ${t.divider}`}>
       {subs.map(s=><div key={s.id} className="flex items-center gap-2 pl-12 pr-5 py-2.5 transition-colors hover:bg-[var(--a-hover)]">
        <span className="h-1 w-1 rounded-full flex-none bg-[var(--a-faint)]"/><span className={`flex-1 text-sm ${t.sub}`}>{s.name}</span>{del(s.id,s.name)}
       </div>)}
       {canManage&&<div className={`flex items-center gap-2 pl-10 pr-4 py-2.5 border-t ${t.divider}`}>
        <input type="text" placeholder="Add subcategory…" value={subForm[cat.id]??''} onChange={e=>setSubForm(p=>({...p,[cat.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addCategory(subForm[cat.id]??'',cat.id)} className={`flex-1 rounded-lg border px-3 py-1.5 text-xs focus:outline-none transition-colors ${t.input}`}/>
        <button onClick={()=>addCategory(subForm[cat.id]??'',cat.id)} disabled={addingSub[cat.id]||!subForm[cat.id]?.trim()} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${t.brandBtn}`}>{addingSub[cat.id]?'…':'Add'}</button>
       </div>}
      </div>}
     </div>;})}
    </div>}
   </div>
  </div>
 </div>;
}
