'use client';
import {useState} from 'react';
import {Check,Loader2,PenLine} from 'lucide-react';
import {useZarn,type ZProject} from './ZarnProvider';
// The project's written brief: what it is, goals, scope and deadlines. The owner (and admins) edit it; everyone on the project reads it.
export default function ProjectBrief({project,canEdit,onSaved,clientName}:{project:ZProject;canEdit:boolean;onSaved:(brief:string)=>void;clientName:string}){
 const {db,reloadProjects}=useZarn();
 const [text,setText]=useState(project.brief),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){
  setBusy(true);setError('');
  const {error:e}=await db.from('zarn_projects').update({brief:text.trim()}).eq('id',project.id);
  setBusy(false);
  if(e){setError('Could not save the brief.');return;}
  onSaved(text.trim());void reloadProjects();setEditing(false);
 }
 return <div className="zp-brief">
  <div className="zp-brief-head"><div><h2>Project brief</h2>{clientName&&<small>For {clientName}</small>}</div>
   {canEdit&&!editing&&<button type="button" className="zn-btn" onClick={()=>{setText(project.brief);setEditing(true);}}><PenLine size={14}/>{project.brief?'Edit brief':'Write brief'}</button>}
  </div>
  {editing?<>
   <textarea className="zn-input zp-brief-edit" rows={14} maxLength={20000} autoFocus value={text} onChange={e=>setText(e.target.value)} placeholder={'What is this project about?\n\nGoals\nScope and deliverables\nDeadlines and milestones\nWho is involved'}/>
   {error&&<p className="zn-error" role="alert">{error}</p>}
   <div className="zp-brief-actions"><button type="button" className="zn-btn" disabled={busy} onClick={()=>{setText(project.brief);setEditing(false);}}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void save()}>{busy?<><Loader2 size={14} className="zn-spin"/>Saving…</>:<><Check size={14}/>Save brief</>}</button></div>
  </>:project.brief?<div className="zp-brief-body">{project.brief}</div>
   :<div className="zn-empty-state"><h2>No brief yet</h2><p>{canEdit?'Write what this project is about, the goals, scope and deadlines so everyone starts on the same page.':'The project owner hasn’t written a brief yet.'}</p></div>}
 </div>;
}
