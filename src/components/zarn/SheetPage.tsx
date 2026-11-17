'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AlignCenter,AlignLeft,AlignRight,Bold,Check,ChevronLeft,ChevronRight,Download,Loader2,Plus,Share2,Trash2,X} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import ShareDoc from './ShareDoc';
import {COLS,ROWS,blankTab,colName,evaluate,readSheet,ref,type SheetData,type Tab} from '@/lib/sheet';

type Row={id:string;title:string;content:string;owner_id:string;kind:string;drive:'my'|'team'|'client';folder_id:string|null;lead_id:string|null};
type Role='owner'|'edit'|'view';
type Edit={tab:string;k:string;v:string};

// A spreadsheet in Drive: tabs, formulas, bold and alignment, copy/paste with other spreadsheet apps, CSV download.
// Changes save by themselves and show up live for everyone who has it open.
export default function SheetPage({id}:{id:string}){
 const {db,me,channels,title:chTitle}=useZarn(),router=useRouter(),confirm=useConfirm();
 const [row,setRow]=useState<Row|null|undefined>(undefined),[role,setRole]=useState<Role|null>(null);
 const [data,setData]=useState<SheetData>({tabs:[blankTab()]}),[tabId,setTabId]=useState(''),[title,setTitle]=useState('');
 const [sel,setSel]=useState<[number,number]>([0,0]),[anchor,setAnchor]=useState<[number,number]|null>(null),[editing,setEditing]=useState<string|null>(null);
 const [state,setState]=useState<'saved'|'saving'|'error'>('saved'),[sharing,setSharing]=useState(false),[crumbs,setCrumbs]=useState<{name:string;href:string}[]>([]),[renaming,setRenaming]=useState<string|null>(null);
 const latest=useRef<{data:SheetData;title:string}>({data,title}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),live=useRef<ReturnType<typeof db.channel>|null>(null);
 const grid=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const canEdit=role==='owner'||role==='edit';

 useEffect(()=>{let on=true;void (async()=>{
  const [{data:d},{data:r}]=await Promise.all([db.from('zarn_docs').select('id,title,content,owner_id,kind,drive,folder_id,lead_id').eq('id',id).maybeSingle(),db.rpc('zarn_doc_role',{d:id})]);
  if(!on)return;
  if(d&&(d as Row).kind!=='sheet'){router.replace(`/zarn/docs/${id}`);return;}
  setRow((d as Row|null)??null);setRole((r as Role|null)??null);
  if(d){const s=readSheet((d as Row).content);setData(s);setTabId(s.tabs[0].id);setTitle((d as Row).title);latest.current={data:s,title:(d as Row).title};
   void db.from('zarn_drive_opens').upsert({user_id:me.user_id,kind:'doc',item_id:id,opened_at:new Date().toISOString()});}
 })();return()=>{on=false;};},[db,id,me.user_id,router]);

 // Breadcrumb back through Drive.
 useEffect(()=>{if(!row)return;let on=true;void (async()=>{
  const client=channels.find(c=>c.kind==='client'&&c.lead_id===row.lead_id);
  const root=row.drive==='team'?{name:'Team drive',href:'/zarn/drive?v=team'}:row.drive==='client'?{name:client?chTitle(client):'Client drive',href:`/zarn/drive?v=client&l=${row.lead_id}`}:row.owner_id===me.user_id?{name:'My Drive',href:'/zarn/drive'}:{name:'Shared with me',href:'/zarn/drive?v=shared'};
  const trail:{name:string;href:string}[]=[];let f=row.folder_id,h=0;
  while(f&&h<20){const {data:x}=await db.from('zarn_drive_folders').select('id,name,parent_id').eq('id',f).maybeSingle();if(!x)break;trail.unshift({name:x.name as string,href:`/zarn/drive?f=${x.id}`});f=x.parent_id as string|null;h++;}
  if(on)setCrumbs([root,...trail]);})();return()=>{on=false;};},[row,db,channels,chTitle,me.user_id]);

 const save=useCallback(async()=>{
  timer.current=null;setState('saving');
  const {error}=await db.from('zarn_docs').update({title:latest.current.title.trim()||'Untitled',content:JSON.stringify(latest.current.data),updated_by:me.user_id}).eq('id',id);
  setState(error?'error':'saved');
 },[db,id,me.user_id]);
 const queue=useCallback(()=>{setState('saving');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void save(),700);},[save]);
 useEffect(()=>()=>{if(timer.current){clearTimeout(timer.current);void save();}},[save]);

 // Live: cell edits are broadcast to others with the sheet open and applied there.
 const apply=useCallback((edits:Edit[],from:'me'|'them')=>{
  setData(d=>{const tabs=d.tabs.map(t=>{const mine=edits.filter(e=>e.tab===t.id);if(!mine.length)return t;const cells={...t.cells};for(const e of mine){if(e.v==='')delete cells[e.k];else cells[e.k]=e.v;}return {...t,cells};});
   const n={tabs};latest.current.data=n;return n;});
  if(from==='me'){queue();void live.current?.send({type:'broadcast',event:'cells',payload:{edits}});}
 },[queue]);
 const setTabs=useCallback((fn:(t:Tab[])=>Tab[])=>{setData(d=>{const n={tabs:fn(d.tabs)};latest.current.data=n;void live.current?.send({type:'broadcast',event:'tabs',payload:{tabs:n.tabs.map(t=>({...t,cells:undefined}))}});return n;});queue();},[queue]);
 useEffect(()=>{
  if(!row)return;
  const ch=db.channel(`zarn-sheet:${id}`);
  ch.on('broadcast',{event:'cells'},({payload}:{payload:unknown})=>apply((payload as {edits:Edit[]}).edits,'them'))
   .on('broadcast',{event:'tabs'},({payload}:{payload:unknown})=>setData(d=>{const meta=(payload as {tabs:Tab[]}).tabs;const n={tabs:meta.map(m=>({...m,cells:d.tabs.find(t=>t.id===m.id)?.cells??{}}))};latest.current.data=n;return n;}))
   .subscribe();
  live.current=ch;return()=>{live.current=null;void db.removeChannel(ch);};
 },[db,id,row,apply]);

 const tab=data.tabs.find(t=>t.id===tabId)??data.tabs[0];
 const values=useMemo(()=>evaluate(tab),[tab]);
 const k=ref(sel[0],sel[1]);
 const box=useMemo(()=>{const a=anchor??sel;return {c0:Math.min(a[0],sel[0]),c1:Math.max(a[0],sel[0]),r0:Math.min(a[1],sel[1]),r1:Math.max(a[1],sel[1])};},[anchor,sel]);
 const inBox=(c:number,r:number)=>c>=box.c0&&c<=box.c1&&r>=box.r0&&r<=box.r1;
 const boxKeys=()=>{const out:string[]=[];for(let r=box.r0;r<=box.r1;r++)for(let c=box.c0;c<=box.c1;c++)out.push(ref(c,r));return out;};

 const commit=(v:string|null=editing)=>{if(v===null)return;if(canEdit&&(tab.cells[k]??'')!==v)apply([{tab:tab.id,k,v}],'me');setEditing(null);grid.current?.focus();};
 const go=(dc:number,dr:number,extend=false)=>{if(extend&&!anchor)setAnchor(sel);if(!extend)setAnchor(null);setSel(([c,r])=>[Math.max(0,Math.min(COLS-1,c+dc)),Math.max(0,Math.min(ROWS-1,r+dr))]);};
 useEffect(()=>{grid.current?.querySelector('.is-cur')?.scrollIntoView({block:'nearest',inline:'nearest'});},[sel]);
 useEffect(()=>{if(editing!==null)input.current?.focus();},[editing]);

 function style(kind:'bold'|'l'|'c'|'r'){
  if(!canEdit)return;const keys=boxKeys();
  setTabs(ts=>ts.map(t=>{if(t.id!==tab.id)return t;
   if(kind==='bold'){const on=!keys.every(x=>t.bold?.[x]);const b={...t.bold};for(const x of keys){if(on)b[x]=true;else delete b[x];}return {...t,bold:b};}
   const a={...t.align};for(const x of keys){if(kind==='l')delete a[x];else a[x]=kind;}return {...t,align:a};}));
 }
 function onKey(e:React.KeyboardEvent){
  if(editing!==null)return;
  const mod=e.metaKey||e.ctrlKey;
  if(e.key==='ArrowUp'){e.preventDefault();go(0,-1,e.shiftKey);}else if(e.key==='ArrowDown'){e.preventDefault();go(0,1,e.shiftKey);}
  else if(e.key==='ArrowLeft'){e.preventDefault();go(-1,0,e.shiftKey);}else if(e.key==='ArrowRight'||e.key==='Tab'){e.preventDefault();go(e.key==='Tab'&&e.shiftKey?-1:1,0,e.key!=='Tab'&&e.shiftKey);}
  else if(e.key==='Enter'){e.preventDefault();if(canEdit)setEditing(tab.cells[k]??'');}
  else if(e.key==='F2'){if(canEdit)setEditing(tab.cells[k]??'');}
  else if((e.key==='Delete'||e.key==='Backspace')&&canEdit){e.preventDefault();apply(boxKeys().filter(x=>tab.cells[x]).map(x=>({tab:tab.id,k:x,v:''})),'me');}
  else if(mod&&e.key.toLowerCase()==='b'){e.preventDefault();style('bold');}
  else if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();setAnchor([0,0]);setSel([COLS-1,ROWS-1]);}
  else if(e.key==='Escape')setAnchor(null);
  else if(!mod&&!e.altKey&&e.key.length===1&&canEdit){e.preventDefault();setEditing(e.key);}
 }
 // Copy and paste as tab-separated text, so it works with Excel, Numbers and Google Sheets.
 function onCopy(e:React.ClipboardEvent){if(editing!==null)return;e.preventDefault();const lines:string[]=[];for(let r=box.r0;r<=box.r1;r++){const cols:string[]=[];for(let c=box.c0;c<=box.c1;c++)cols.push(values[ref(c,r)]??'');lines.push(cols.join('\t'));}e.clipboardData.setData('text/plain',lines.join('\n'));}
 function onPaste(e:React.ClipboardEvent){if(editing!==null||!canEdit)return;e.preventDefault();const txt=e.clipboardData.getData('text/plain');if(!txt)return;
  const edits:Edit[]=[];txt.replace(/\r/g,'').replace(/\n$/,'').split('\n').forEach((line,dr)=>line.split('\t').forEach((v,dc)=>{const c=box.c0+dc,r=box.r0+dr;if(c<COLS&&r<ROWS)edits.push({tab:tab.id,k:ref(c,r),v});}));apply(edits,'me');}
 function csv(){const used=Object.keys(tab.cells);let mc=0,mr=0;for(const x of used){const c=x.charCodeAt(0)-65,r=Number(x.slice(1))-1;mc=Math.max(mc,c);mr=Math.max(mr,r);}
  const q=(s:string)=>/[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;const lines:string[]=[];
  for(let r=0;r<=mr;r++){const cols:string[]=[];for(let c=0;c<=mc;c++)cols.push(q(values[ref(c,r)]??''));lines.push(cols.join(','));}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'}));a.download=`${(title||'Sheet').replace(/[^\w\- ]+/g,'')}-${tab.name}.csv`;a.click();URL.revokeObjectURL(a.href);}

 async function addTab(){const t=blankTab(data.tabs.length+1);setTabs(ts=>[...ts,t]);setTabId(t.id);}
 const renameTab=(t:Tab,n:string)=>{setRenaming(null);const v=n.trim();if(v&&v!==t.name)setTabs(ts=>ts.map(x=>x.id===t.id?{...x,name:v.slice(0,40)}:x));};
 async function dropTab(t:Tab){if(data.tabs.length<2||!await confirm({title:`Delete “${t.name}”?`,message:'Everything on this tab is removed.',confirm:'Delete tab',danger:true}))return;setTabs(ts=>ts.filter(x=>x.id!==t.id));if(tabId===t.id)setTabId(data.tabs.find(x=>x.id!==t.id)!.id);}
 async function remove(){if(!await confirm({title:'Move this sheet to the trash?',message:`“${title||'Untitled'}” goes to the Drive trash. You can restore it from there.`,confirm:'Move to trash',danger:true}))return;
  await db.from('zarn_docs').update({trashed_at:new Date().toISOString()}).eq('id',id);router.push(crumbs.at(-1)?.href??'/zarn/drive');}

 if(row===undefined)return <div className="zn-page"><p className="zn-loading">Loading…</p></div>;
 if(!row||!role)return <div className="zn-page"><div className="zn-empty-state"><h2>Sheet not found</h2><p>It may have been deleted, or it isn’t shared with you.</p><Link className="zn-btn" href="/zarn/drive">Back to Drive</Link></div></div>;
 const al=tab.align?.[k];
 return <div className="zn-page zd-page zs-page">
  {sharing&&<ShareDoc docId={id} onClose={()=>setSharing(false)}/>}
  <header className="zd-head">
   <Link href={crumbs.at(-1)?.href??'/zarn/drive'} className="zn-icon" aria-label="Back"><ChevronLeft size={20}/></Link>
   <nav className="zd-crumbs" aria-label="Location">{crumbs.map(c=><span key={c.href}><Link href={c.href}>{c.name}</Link><ChevronRight size={14}/></span>)}</nav>
   <input className="zd-title" value={title} readOnly={!canEdit} maxLength={200} placeholder="Untitled" aria-label="Title" onChange={e=>{setTitle(e.target.value);latest.current.title=e.target.value;queue();}}/>
   <span className={`zd-state${state==='error'?' is-error':''}`}>{!canEdit?'View only':state==='saving'?<><Loader2 size={13} className="zn-spin"/>Saving…</>:state==='error'?'Not saved. Retry by typing.':<><Check size={13}/>Saved</>}</span>
   <button type="button" className="zd-del" aria-label="Download CSV" data-tip="Download this tab as CSV" onClick={csv}><Download size={16}/></button>
   {role==='owner'&&<><button type="button" className="zn-btn" onClick={()=>setSharing(true)}><Share2 size={14}/>Share</button><button type="button" className="zd-del" aria-label="Move to trash" data-tip="Move to trash" onClick={()=>void remove()}><Trash2 size={16}/></button></>}
  </header>
  <div className="zs-bar">
   <span className="zs-ref">{anchor&&(box.c0!==box.c1||box.r0!==box.r1)?`${ref(box.c0,box.r0)}:${ref(box.c1,box.r1)}`:k}</span>
   {canEdit&&<><button type="button" className={`zs-tool${tab.bold?.[k]?' is-on':''}`} aria-label="Bold" data-tip="Bold (Ctrl/Cmd+B)" onClick={()=>style('bold')}><Bold size={15}/></button>
    <button type="button" className={`zs-tool${!al?' is-on':''}`} aria-label="Align left" onClick={()=>style('l')}><AlignLeft size={15}/></button>
    <button type="button" className={`zs-tool${al==='c'?' is-on':''}`} aria-label="Align centre" onClick={()=>style('c')}><AlignCenter size={15}/></button>
    <button type="button" className={`zs-tool${al==='r'?' is-on':''}`} aria-label="Align right" onClick={()=>style('r')}><AlignRight size={15}/></button></>}
   <span className="zs-fx">fx</span>
   <input className="zs-formula" value={editing??tab.cells[k]??''} readOnly={!canEdit} aria-label="Cell contents" placeholder={canEdit?'Type a value or a formula like =SUM(A1:A5)':''}
    onFocus={()=>{if(editing===null&&canEdit)setEditing(tab.cells[k]??'');}} onChange={e=>setEditing(e.target.value)}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit(e.currentTarget.value);go(0,1);}else if(e.key==='Escape'){setEditing(null);grid.current?.focus();}}}/>
  </div>
  <div ref={grid} className="zs-grid" tabIndex={0} onKeyDown={onKey} onCopy={onCopy} onPaste={onPaste} data-lenis-prevent>
   <table><thead><tr><th className="zs-corner"/>{Array.from({length:COLS},(_,c)=><th key={c} className={c>=box.c0&&c<=box.c1?'is-hl':''}>{colName(c)}</th>)}</tr></thead>
    <tbody>{Array.from({length:ROWS},(_,r)=><tr key={r}><th className={r>=box.r0&&r<=box.r1?'is-hl':''}>{r+1}</th>{Array.from({length:COLS},(_,c)=>{const x=ref(c,r),cur=c===sel[0]&&r===sel[1],v=values[x]??'';
     return <td key={c} className={`${cur?'is-cur':''}${inBox(c,r)&&!cur?' is-in':''}${tab.bold?.[x]?' is-b':''}${tab.align?.[x]?` is-${tab.align[x]}`:''}${/^#[A-Z/0!?]+$/.test(v)?' is-err':''}${v!==''&&!Number.isNaN(Number(v))&&!tab.align?.[x]?' is-num':''}`}
      onMouseDown={e=>{if(editing!==null)commit();if(e.shiftKey){if(!anchor)setAnchor(sel);}else setAnchor([c,r]);setSel([c,r]);}}
      onMouseEnter={e=>{if(e.buttons===1){setSel([c,r]);}}}
      onDoubleClick={()=>{if(canEdit)setEditing(tab.cells[x]??'');}}>
      {cur&&editing!==null?<input ref={input} className="zs-in" value={editing} onChange={e=>setEditing(e.target.value)} onBlur={()=>commit()}
       onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();go(0,e.shiftKey?-1:1);}else if(e.key==='Tab'){e.preventDefault();commit();go(e.shiftKey?-1:1,0);}else if(e.key==='Escape'){setEditing(null);grid.current?.focus();}}}/>:v}
     </td>;})}</tr>)}</tbody></table>
  </div>
  <footer className="zs-tabs">
   {canEdit&&<button type="button" className="zs-tab-add" aria-label="Add tab" onClick={()=>void addTab()}><Plus size={15}/></button>}
   {data.tabs.map(t=><span key={t.id} className={`zs-tab${t.id===tab.id?' is-on':''}`}>{renaming===t.id?<input className="zs-tab-in" defaultValue={t.name} autoFocus maxLength={40} aria-label="Tab name" onBlur={e=>renameTab(t,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')renameTab(t,e.currentTarget.value);else if(e.key==='Escape')setRenaming(null);}}/>
    :<button type="button" onClick={()=>{setTabId(t.id);setSel([0,0]);setAnchor(null);}} onDoubleClick={()=>{if(canEdit)setRenaming(t.id);}} title={canEdit?'Double-click to rename':undefined}>{t.name}</button>}
    {canEdit&&data.tabs.length>1&&t.id===tab.id&&<button type="button" className="zs-tab-x" aria-label={`Delete ${t.name}`} onClick={()=>void dropTab(t)}><X size={12}/></button>}</span>)}
  </footer>
 </div>;
}
