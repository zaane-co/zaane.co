'use client';
import Dropdown from '@/components/ui/Dropdown';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowDown,ArrowUp,Lock,Plus,Trash2,X} from 'lucide-react';
import {stageColors,crmApi,type PipelineStage} from '@/lib/crm';

export function StageBadge({stage,fallback}:{stage?:PipelineStage;fallback:string}){
 return <span className="za-status" style={{background:stage?.color??'#52525b'}}>{stage?.label??fallback}</span>;
}

// Slide-over for editing the pipeline: add, rename, recolour, reorder and delete stages.
// Open stages can be reordered; Won and Lost always close the board.
export default function StageManager({stages,counts,onClose}:{stages:PipelineStage[];counts:Record<string,number>;onClose:()=>void}){
 const router=useRouter();
 const [list,setList]=useState(stages),[seen,setSeen]=useState(stages);
 if(seen!==stages){setSeen(stages);setList(stages);}
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [palette,setPalette]=useState<string|null>(null),[removing,setRemoving]=useState<string|null>(null),[moveTo,setMoveTo]=useState('');
 const [newLabel,setNewLabel]=useState(''),[newColor,setNewColor]=useState(stageColors[6]!);
 useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[onClose]);
 const open=list.filter(s=>s.kind==='open'),closing=list.filter(s=>s.kind!=='open');

 async function run(body:object){
  setBusy(true);setError('');
  try{await crmApi(body);router.refresh();return true;}
  catch(e){setError(e instanceof Error?e.message:'Something went wrong.');setList(stages);return false;}
  finally{setBusy(false);}
 }
 const patch=(key:string,p:Partial<PipelineStage>)=>setList(l=>l.map(s=>s.key===key?{...s,...p}:s));
 function rename(s:PipelineStage,label:string){
  const clean=label.trim();const orig=stages.find(x=>x.key===s.key);
  if(!clean){patch(s.key,{label:orig?.label??s.label});return;}
  if(clean!==orig?.label)void run({action:'stage_update',key:s.key,label:clean});
 }
 function recolor(s:PipelineStage,color:string){setPalette(null);patch(s.key,{color});void run({action:'stage_update',key:s.key,color});}
 function move(i:number,dir:-1|1){
  const next=[...open],j=i+dir;if(j<0||j>=next.length)return;
  [next[i],next[j]]=[next[j]!,next[i]!];
  setList([...next.map((s,position)=>({...s,position})),...closing]);
  void run({action:'stage_reorder',keys:next.map(s=>s.key)});
 }
 async function add(e:React.FormEvent){e.preventDefault();if(await run({action:'stage_create',label:newLabel,color:newColor}))setNewLabel('');}
 async function remove(key:string){if(await run({action:'stage_delete',key,move_to:moveTo})){setRemoving(null);setList(l=>l.filter(s=>s.key!==key));}}

 const Row=({s,i}:{s:PipelineStage;i?:number})=><li className="za-stage-row">
  <div className="za-stage-main">
   <button type="button" className="za-swatch" style={{background:s.color}} aria-label={`Colour for ${s.label}`} data-tip="Change colour" onClick={()=>setPalette(palette===s.key?null:s.key)}/>
   <input aria-label="Stage name" maxLength={40} value={s.label} disabled={busy&&removing===s.key} onChange={e=>patch(s.key,{label:e.target.value})} onBlur={e=>rename(s,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
   <span className="za-stage-count" data-tip={`${counts[s.key]??0} lead${counts[s.key]===1?'':'s'}`}>{counts[s.key]??0}</span>
   {i!=null&&<><button type="button" className="za-stage-icon" aria-label="Move up" data-tip="Move up" disabled={busy||i===0} onClick={()=>move(i,-1)}><ArrowUp size={14}/></button>
    <button type="button" className="za-stage-icon" aria-label="Move down" data-tip="Move down" disabled={busy||i===open.length-1} onClick={()=>move(i,1)}><ArrowDown size={14}/></button></>}
   {s.system?<span className="za-stage-icon is-locked" data-tip={s.kind==='open'?'Website briefs land here':'Used for win rate and stats'}><Lock size={13}/></span>
    :<button type="button" className="za-stage-icon za-row-danger" aria-label={`Delete ${s.label}`} data-tip="Delete" onClick={()=>{setRemoving(s.key);setMoveTo(list.find(x=>x.key!==s.key&&x.kind==='open')?.key??'new');}}><Trash2 size={14}/></button>}
  </div>
  {palette===s.key&&<div className="za-palette" role="group" aria-label="Colours">{stageColors.map(c=><button key={c} type="button" className={c===s.color?'is-on':''} style={{background:c}} aria-label={c} onClick={()=>recolor(s,c)}/>)}</div>}
  {removing===s.key&&<div className="za-stage-remove">
   <span>{counts[s.key]?<>Move its {counts[s.key]} lead{counts[s.key]===1?'':'s'} to</>:'Delete this stage?'}</span>
   {!!counts[s.key]&&<Dropdown variant="toolbar" label="Move leads to" value={moveTo} onChange={setMoveTo} options={list.filter(x=>x.key!==s.key).map(x=>({value:x.key,label:x.label,color:x.color}))}/>}
   <button type="button" className="za-btn za-btn-danger" disabled={busy} onClick={()=>void remove(s.key)}>Delete stage</button>
   <button type="button" className="za-btn za-btn-ghost" onClick={()=>setRemoving(null)}>Cancel</button>
  </div>}
 </li>;

 return <>
  <button className="za-drawer-scrim" aria-label="Close" onClick={onClose}/>
  <aside className="za-drawer" role="dialog" aria-label="Pipeline stages">
   <div className="za-drawer-head"><div><p>Leads</p><h2>Pipeline stages</h2></div><button className="za-icon-btn" onClick={onClose} aria-label="Close" data-tip="Close"><X size={18}/></button></div>
   <div className="za-drawer-body" data-lenis-prevent>
    <p className="za-muted-note">Changes save as you go. Rename a stage by editing its name, click the dot to change its colour. Stages with a lock can be renamed and recoloured but not deleted: website briefs land in the first one, and Won and Lost drive your win rate and monthly stats.</p>
    <div className="za-field-label"><label>Pipeline</label></div>
    <ul className="za-stage-list">{open.map((s,i)=>Row({s,i}))}</ul>
    <form className="za-stage-add" onSubmit={add}>
     <button type="button" className="za-swatch" style={{background:newColor}} aria-label="Colour for new stage" onClick={()=>setPalette(palette==='__new'?null:'__new')}/>
     <input placeholder="New stage, e.g. Discovery call" maxLength={40} value={newLabel} onChange={e=>setNewLabel(e.target.value)}/>
     <button className="za-btn za-btn-primary" disabled={busy||!newLabel.trim()}><Plus size={14}/>Add</button>
    </form>
    {palette==='__new'&&<div className="za-palette" role="group" aria-label="Colours">{stageColors.map(c=><button key={c} type="button" className={c===newColor?'is-on':''} style={{background:c}} aria-label={c} onClick={()=>{setNewColor(c);setPalette(null);}}/>)}</div>}
    <div className="za-field-label"><label>Closing stages</label></div>
    <ul className="za-stage-list">{closing.map(s=>Row({s}))}</ul>
    {error&&<p role="alert" className="za-flash">{error}</p>}
    <div className="za-drawer-foot"><button type="button" className="za-btn za-btn-primary za-push" onClick={onClose}>Done</button></div>
   </div>
  </aside>
 </>;
}
