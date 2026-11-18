'use client';
/* eslint-disable react-hooks/refs -- menu items carry click handlers that use refs; they run on click, never during render */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ChevronUp,CloudCheck,CloudOff,AlignCenter,AlignLeft,AlignRight,Bold,Check,ChevronDown,ChevronRight,FileSpreadsheet,Folder,Italic,Loader2,Menu,PaintBucket,Percent,Plus,Printer,Redo2,Search,Share2,Sigma,Strikethrough,Pencil,Underline,Undo2,WrapText,X,Eraser,SquareCheckBig,SquareChevronDown,Trash2,Filter,ListFilter,ArrowDownAZ,ArrowUpZA,TableCellsMerge,Highlighter,Link as LinkIcon,CalendarDays,ExternalLink,Unlink,ChevronLeft,Grid2x2,ChartColumnBig,ChartBarBig,ChartLine,ChartPie,ChartArea,ChartScatter,ImagePlus,MessageSquarePlus,CircleCheck} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import ShareDoc from './ShareDoc';
import {Modal} from './Dialogs';
import {Avatar} from './format';
import {uploadEditorImage} from './editor-images';
import {PivotEditor,ProtectPanel,VersionPanel} from './SheetExtras';
import {sheetToXlsx} from './sheet-to-xlsx';
import {CHIP_COLORS,COLS,COL_W,FUNCTIONS,FUNCTION_NAMES,ROWS,ROW_H,adjustRefs,blankTab,chipInk,colName,dateToSerial,evaluate,exprEval,linkOf,parseDateText,serialToDate,isError,parseRange,parseRef,protAt,readSheet,ref,runPivot,shiftRefs,show,type ChartType,type CfRule,type Cmt,type Obj,type Rule,type SheetData,type Style,type Tab} from '@/lib/sheet';

type Row={id:string;title:string;content:string;owner_id:string;kind:string;drive:'my'|'team'|'client';folder_id:string|null;lead_id:string|null};
type Role='owner'|'edit'|'view';
type Edit={tab:string;k:string;v:string};
type Box={c0:number;c1:number;r0:number;r1:number};
type Peer={u:string;t:string;s:string};
const HEAD_H=24,ROWHEAD_W=46;
const palette=['#000000','#434343','#666666','#999999','#cccccc','#efefef','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#b91c1c','#c2410c','#a16207','#15803d','#0e7490','#1d4ed8','#6d28d9','#be185d','#fecaca','#fed7aa','#fef08a','#bbf7d0','#a5f3fc','#bfdbfe','#ddd6fe','#fbcfe8'];
const peerColors=['#e8710a','#9334e6','#12b5cb','#d93025','#188038','#f9ab00','#1a73e8','#c5221f'];
const colorOf=(id:string)=>peerColors[[...id].reduce((a,ch)=>a+ch.charCodeAt(0),0)%peerColors.length];
const fontSizes=[8,9,10,11,12,13,14,16,18,20,24,28,36];
const zooms=[0.5,0.75,0.9,1,1.25,1.5,2];
const newId=()=>Math.random().toString(36).slice(2,10);
// Toolbar menus open under their button; nudge one left if it would run off the right edge of the screen.
const fitMenu=(el:HTMLElement|null)=>{if(!el)return;el.style.marginLeft='';const r=el.getBoundingClientRect();if(r.right>window.innerWidth-8)el.style.marginLeft=`${Math.round(window.innerWidth-8-r.right)}px`;};

// A spreadsheet in Drive, built to feel like Google Sheets: menus, a full toolbar, the name box and formula bar,
// a fast grid with frozen rows/columns, fill handle and resizable columns, formulas with suggestions, and live co-editing.
export default function SheetPage({id}:{id:string}){
 const {db,me,people,members,channels,title:chTitle}=useZarn(),router=useRouter(),confirm=useConfirm();
 const [row,setRow]=useState<Row|null|undefined>(undefined),[role,setRole]=useState<Role|null>(null);
 const [data,setData]=useState<SheetData>({tabs:[blankTab()]}),[tabId,setTabId]=useState(''),[title,setTitle]=useState('');
 const [sel,setSel]=useState<[number,number]>([0,0]),[anchor,setAnchor]=useState<[number,number]|null>(null);
 const [editing,setEditing]=useState<string|null>(null),[editMode,setEditMode]=useState<'type'|'edit'>('edit'),[editIn,setEditIn]=useState<'cell'|'bar'>('cell'),[pick,setPick]=useState(0);
 const [state,setState]=useState<'saved'|'saving'|'error'>('saved'),[sharing,setSharing]=useState(false),[crumbs,setCrumbs]=useState<{name:string;href:string}[]>([]);
 const [toolSheet,setToolSheet]=useState(false),[dd,setDd]=useState<string|null>(null),[ruleEdit,setRuleEdit]=useState<Rule|null>(null),[warn,setWarn]=useState(''),[fpop,setFpop]=useState<{c:number;x:number;y:number}|null>(null),[bdLine,setBdLine]=useState('1px solid'),[bdColor,setBdColor]=useState('currentColor'),[cfOpen,setCfOpen]=useState(false),[linkEdit,setLinkEdit]=useState<{text:string;url:string}|null>(null),[noteEdit,setNoteEdit]=useState<string|null>(null),[cmtOpen,setCmtOpen]=useState<string|null>(null),[cmtPanel,setCmtPanel]=useState(false),[objSel,setObjSel]=useState<string|null>(null),[objDraft,setObjDraft]=useState<{id:string;x:number;y:number;w:number;h:number}|null>(null),[chartEdit,setChartEdit]=useState<string|null>(null),[imgBusy,setImgBusy]=useState(false);
 const [preview,setPreview]=useState<{id:string;label:string;data:SheetData}|null>(null),[verOpen,setVerOpen]=useState(false),[protOpen,setProtOpen]=useState(false),[showProt,setShowProt]=useState(false),[pivOpen,setPivOpen]=useState(true);
 const base=useRef(''),snapAt=useRef(0),guard=useRef<(a:SheetData,b:SheetData)=>{block?:string;warn?:boolean}|null>(()=>null);
 const imgIn=useRef<HTMLInputElement>(null),imgMode=useRef<'cell'|'over'>('cell'),objDrag=useRef<{id:string;mode:'move'|'size';sx:number;sy:number;o:{x:number;y:number;w:number;h:number}}|null>(null);
 const [menu,setMenu]=useState<string|null>(null),[pop,setPop]=useState<string|null>(null),[ctx,setCtx]=useState<{x:number;y:number}|null>(null),[tabMenu,setTabMenu]=useState<string|null>(null),[renamingTab,setRenamingTab]=useState<string|null>(null);
 const [zoom,setZoom]=useState(1),[grid,setGrid]=useState(true),[find,setFind]=useState<{q:string;rep:string;at:number}|null>(null),[help,setHelp]=useState<'keys'|'fx'|null>(null);
 const [scroll,setScroll]=useState({top:0,h:800}),[drafts,setDrafts]=useState<Record<string,number>>({}),[fill,setFill]=useState<[number,number]|null>(null),[peers,setPeers]=useState<Record<string,Peer>>({}),[hl,setHl]=useState({u:0,r:0});
 const latest=useRef<{data:SheetData;title:string}>({data,title}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),live=useRef<ReturnType<typeof db.channel>|null>(null);
 const hist=useRef<{past:SheetData[];future:SheetData[]}>({past:[],future:[]}),clip=useRef<{cells:Record<string,string>;style:Record<string,Style>;box:Box;cut:boolean;text:string}|null>(null);
 const gridRef=useRef<HTMLDivElement>(null),cellIn=useRef<HTMLInputElement>(null),barIn=useRef<HTMLInputElement>(null),titleIn=useRef<HTMLInputElement>(null),csvIn=useRef<HTMLInputElement>(null);
 const drag=useRef<{kind:'sel'|'fill'|'fx'|'resize'|null;start?:[number,number];x?:number;w?:number;col?:number;at?:number;len?:number}>({kind:null});
 const canEdit=(role==='owner'||role==='edit')&&!preview;

 // ---------- Load, save, live ----------
 useEffect(()=>{let on=true;void (async()=>{
  const [{data:d},{data:r}]=await Promise.all([db.from('zarn_docs').select('id,title,content,owner_id,kind,drive,folder_id,lead_id').eq('id',id).maybeSingle(),db.rpc('zarn_doc_role',{d:id})]);
  if(!on)return;
  if(d&&(d as Row).kind!=='sheet'){router.replace(`/zarn/docs/${id}`);return;}
  setRow((d as Row|null)??null);setRole((r as Role|null)??null);
  if(d){const s=readSheet((d as Row).content);setData(s);setTabId(s.tabs[0].id);setTitle((d as Row).title);latest.current={data:s,title:(d as Row).title};base.current=(d as Row).content;
   void db.from('zarn_doc_versions').select('created_at').eq('doc_id',id).order('created_at',{ascending:false}).limit(1).then(({data:v}:{data:unknown})=>{const t=(v as {created_at:string}[]|null)?.[0]?.created_at;snapAt.current=t?new Date(t).getTime():0;});
   void db.from('zarn_drive_opens').upsert({user_id:me.user_id,kind:'doc',item_id:id,opened_at:new Date().toISOString()});}
 })();return()=>{on=false;};},[db,id,me.user_id,router]);
 useEffect(()=>{if(!row)return;let on=true;void (async()=>{
  const client=channels.find(c=>c.kind==='client'&&c.lead_id===row.lead_id);
  const root=row.drive==='team'?{name:'Team drive',href:'/zarn/drive?v=team'}:row.drive==='client'?{name:client?chTitle(client):'Client drive',href:`/zarn/drive?v=client&l=${row.lead_id}`}:row.owner_id===me.user_id?{name:'My Drive',href:'/zarn/drive?v=my'}:{name:'Shared with me',href:'/zarn/drive?v=shared'};
  const trail:{name:string;href:string}[]=[];let f=row.folder_id,h=0;
  while(f&&h<20){const {data:x}=await db.from('zarn_drive_folders').select('id,name,parent_id').eq('id',f).maybeSingle();if(!x)break;trail.unshift({name:x.name as string,href:`/zarn/drive?f=${x.id}`});f=x.parent_id as string|null;h++;}
  if(on)setCrumbs([root,...trail]);})();return()=>{on=false;};},[row,db,channels,chTitle,me.user_id]);

 // Version history: the first save in each 10-minute stretch of editing keeps a copy of the sheet as it was before.
 const save=useCallback(async()=>{timer.current=null;setState('saving');
  const content=JSON.stringify(latest.current.data),title2=latest.current.title.trim()||'Untitled sheet';
  if(base.current&&base.current!==content&&Date.now()-snapAt.current>10*60e3){snapAt.current=Date.now();void db.from('zarn_doc_versions').insert({doc_id:id,title:title2,content:base.current,created_by:me.user_id}).then(()=>{});}
  const {error}=await db.from('zarn_docs').update({title:title2,content,updated_by:me.user_id}).eq('id',id);
  if(!error)base.current=content;
  setState(error?'error':'saved');},[db,id,me.user_id]);
 const queue=useCallback(()=>{setState('saving');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void save(),700);},[save]);
 useEffect(()=>()=>{if(timer.current){clearTimeout(timer.current);void save();}},[save]);

 // Every change goes through here: it's undoable, saved, and sent to everyone else with the sheet open.
 const apply=useCallback((next:SheetData,edits?:Edit[],undoable=true)=>{
  if(undoable){hist.current.past.push(latest.current.data);if(hist.current.past.length>100)hist.current.past.shift();hist.current.future=[];}
  latest.current.data=next;setData(next);setHl({u:hist.current.past.length,r:hist.current.future.length});queue();
  void live.current?.send({type:'broadcast',event:edits?'cells':'full',payload:edits?{edits}:{data:next}});
 },[queue]);
 const commit=useCallback((next:SheetData,edits?:Edit[],undoable=true,force=false)=>{
  if(!force){const g=guard.current?.(latest.current.data,next);
   if(g?.block){const m=g.block;setWarn(m);setTimeout(()=>setWarn(w=>w===m?'':w),3200);return;}
   if(g?.warn){void confirm({title:'Edit a protected range?',message:'These cells are protected so they aren’t changed by accident. Only carry on if you mean to.',confirm:'Edit anyway',danger:false}).then(ok=>{if(ok)apply(next,edits,undoable);});return;}}
  apply(next,edits,undoable);},[apply,confirm]);
 const applyEdits=(d:SheetData,edits:Edit[]):SheetData=>({tabs:d.tabs.map(t=>{const mine=edits.filter(e=>e.tab===t.id);if(!mine.length)return t;const cells={...t.cells};for(const e of mine){if(e.v==='')delete cells[e.k];else cells[e.k]=e.v;}return {...t,cells};})});
 const setCells=useCallback((edits:Edit[])=>{if(!edits.length)return;commit(applyEdits(latest.current.data,edits),edits);},[commit]);
 const setTab=useCallback((tid:string,fn:(t:Tab)=>Tab)=>commit({tabs:latest.current.data.tabs.map(t=>t.id===tid?fn(t):t)}),[commit]);
 useEffect(()=>{
  if(!row)return;
  const ch=db.channel(`zarn-sheet:${id}`,{config:{presence:{key:me.user_id}}});
  ch.on('broadcast',{event:'cells'},({payload}:{payload:unknown})=>{const n=applyEdits(latest.current.data,(payload as {edits:Edit[]}).edits);latest.current.data=n;setData(n);})
   .on('broadcast',{event:'full'},({payload}:{payload:unknown})=>{const n=(payload as {data:SheetData}).data;latest.current.data=n;setData(n);})
   .on('presence',{event:'sync'},()=>{const st=ch.presenceState() as Record<string,Peer[]>;const out:Record<string,Peer>={};for(const [k,v] of Object.entries(st))if(k!==me.user_id&&v[0])out[k]=v[0];setPeers(out);})
   .subscribe((s:string)=>{if(s==='SUBSCRIBED')void ch.track({u:me.user_id,t:'',s:'A1'});});
  live.current=ch;return()=>{live.current=null;void db.removeChannel(ch);};
 },[db,id,row,me.user_id]);

 // While looking at an old version the grid shows that instead. Pivot tabs get their cells worked out from the source.
 const view=preview?.data??data;
 const pivots=useMemo(()=>{const m:Record<string,ReturnType<typeof runPivot>>={};for(const t of view.tabs)if(t.pivot)m[t.id]=runPivot(t.pivot,view.tabs);return m;},[view.tabs]);
 const tabs=useMemo(()=>view.tabs.map(t=>pivots[t.id]?{...t,cells:pivots[t.id].cells,style:{...pivots[t.id].style,...t.style}}:t),[view.tabs,pivots]);
 const tab=tabs.find(t=>t.id===tabId)??tabs[0];
 const values=useMemo(()=>evaluate(tab,tabs),[tab,tabs]);
 const k=ref(sel[0],sel[1]);
 useEffect(()=>{const t=setTimeout(()=>void live.current?.track({u:me.user_id,t:tab.id,s:k}),150);return()=>clearTimeout(t);},[k,tab.id,me.user_id]);
 const box:Box=useMemo(()=>{const a=anchor??sel;return {c0:Math.min(a[0],sel[0]),c1:Math.max(a[0],sel[0]),r0:Math.min(a[1],sel[1]),r1:Math.max(a[1],sel[1])};},[anchor,sel]);
 const keysIn=(b:Box)=>{const out:string[]=[];for(let r=b.r0;r<=b.r1;r++)for(let c=b.c0;c<=b.c1;c++)out.push(ref(c,r));return out;};
 const used=useMemo(()=>{let mc=-1,mr=-1;for(const x of Object.keys(tab.cells)){const p=parseRef(x);if(p){mc=Math.max(mc,p[0]);mr=Math.max(mr,p[1]);}}return {mc,mr};},[tab.cells]);
 const st=tab.style?.[k]??{};
 const hCols=useMemo(()=>new Set(tab.hCols??[]),[tab.hCols]);
 const width=(c:number)=>hCols.has(c)?0:drafts[c]??tab.widths?.[c]??COL_W;
 const freeze=tab.freeze??{r:0,c:0};
 // ---------- Filter and hidden rows / columns ----------
 const filt=useMemo(()=>{const f=tab.filter;const b=f?parseRange(f.range):null;return f&&b?{hide:f.hide??{},b}:null;},[tab.filter]);
 const hidden=useMemo(()=>{const set=new Set<number>(tab.hRows??[]);
  if(filt){const cols=Object.entries(filt.hide).filter(([,v])=>v.length).map(([c,v])=>[Number(c),new Set(v)] as const);
   if(cols.length)for(let r=filt.b.r0+1;r<=Math.min(filt.b.r1,used.mr);r++)for(const [c,hs] of cols){const x=ref(c,r);if(hs.has(show(values[x],tab.style?.[x]))){set.add(r);break;}}}
  return set;},[tab.hRows,filt,values,used.mr,tab.style]);
 const manualRows=useMemo(()=>new Set(tab.hRows??[]),[tab.hRows]);
 const vis=useMemo(()=>{const a:number[]=[];for(let r=0;r<ROWS;r++)if(!hidden.has(r))a.push(r);return a.length?a:[0];},[hidden]);
 const vIndex=useMemo(()=>{const m=new Int32Array(ROWS).fill(-1);vis.forEach((r,i)=>{m[r]=i;});return m;},[vis]);
 const frozenVis=vis.filter(r=>r<freeze.r);
 const stepR=(r:number,d:number)=>{if(!d)return r;let i=vIndex[r];if(i<0){i=vis.findIndex(x=>x>r);if(i<0)i=vis.length;if(d>0)d--;else i--;}return vis[Math.max(0,Math.min(vis.length-1,i+d))];};
 const stepC=(c:number,d:number)=>{let n=c;const s2=Math.sign(d);for(let left=Math.abs(d);left>0;left--){let m=n+s2;while(m>=0&&m<COLS&&hCols.has(m))m+=s2;if(m<0||m>=COLS)break;n=m;}return n;};
 // A new filter covers the selection, or (from one cell) every used column from the first row with data down to the bottom.
 function createFilter(){if(!canEdit)return;let b:Box;
  if(box.c0!==box.c1||box.r0!==box.r1)b={...box};
  else{let top=ROWS;for(const x of Object.keys(tab.cells)){const p=parseRef(x);if(p)top=Math.min(top,p[1]);}b={c0:0,c1:Math.max(0,used.mc),r0:top===ROWS?0:top,r1:ROWS-1};}
  setTab(tab.id,t=>({...t,filter:{range:`${ref(b.c0,b.r0)}:${ref(b.c1,b.r1)}`,hide:{}}}));}
 function removeFilter(){setTab(tab.id,t=>{const n={...t};delete n.filter;return n;});setFpop(null);}
 function setFilterHide(c:number,vals:string[]){setTab(tab.id,t=>{if(!t.filter)return t;const hide={...t.filter.hide};if(vals.length)hide[c]=vals;else delete hide[c];return {...t,filter:{...t.filter,hide}};});}
 function hideRows(){if(!canEdit)return;const add:number[]=[];for(let r=box.r0;r<=box.r1;r++)add.push(r);setTab(tab.id,t=>({...t,hRows:[...new Set([...(t.hRows??[]),...add])].sort((a,b)=>a-b)}));setAnchor(null);setSel([box.c0,stepR(box.r1,1)]);}
 function hideCols(){if(!canEdit)return;const add:number[]=[];for(let c=box.c0;c<=box.c1;c++)add.push(c);setTab(tab.id,t=>({...t,hCols:[...new Set([...(t.hCols??[]),...add])].sort((a,b)=>a-b)}));setAnchor(null);setSel([stepC(box.c1,1),box.r0]);}
 const unhide=(axis:'r'|'c',from:number,to:number)=>setTab(tab.id,t=>axis==='r'?{...t,hRows:(t.hRows??[]).filter(n=>n<from||n>to)}:{...t,hCols:(t.hCols??[]).filter(n=>n<from||n>to)});
 const runOf=(set:Set<number>,at:number,dir:1|-1)=>{let n=at;while(set.has(n+dir))n+=dir;return n;};
 // ---------- Merged cells ----------
 const merges=useMemo(()=>(tab.merges??[]).map(parseRange).filter((b):b is Box=>!!b),[tab.merges]);
 const mergeAt=(c:number,r:number)=>merges.find(m=>c>=m.c0&&c<=m.c1&&r>=m.r0&&r<=m.r1);
 async function mergeCells(kind:'all'|'h'|'v'|'un'){
  if(!canEdit)return;const b={...box,r1:box.r0===0&&box.r1===ROWS-1?Math.max(used.mr,0):box.r1,c1:box.c0===0&&box.c1===COLS-1?Math.max(used.mc,0):box.c1};
  const keep=(t:Tab)=>(t.merges??[]).filter(x=>{const m=parseRange(x);return m&&(m.c1<b.c0||m.c0>b.c1||m.r1<b.r0||m.r0>b.r1);});
  if(kind==='un'){setTab(tab.id,t=>({...t,merges:keep(t)}));return;}
  const groups:Box[]=[];
  if(kind==='all'){if(b.c0<b.c1||b.r0<b.r1)groups.push(b);}
  else if(kind==='h'){if(b.c0<b.c1)for(let r=b.r0;r<=b.r1;r++)groups.push({c0:b.c0,c1:b.c1,r0:r,r1:r});}
  else if(b.r0<b.r1)for(let c=b.c0;c<=b.c1;c++)groups.push({c0:c,c1:c,r0:b.r0,r1:b.r1});
  if(!groups.length)return;
  const lose:string[]=[];for(const g of groups)for(const x of keysIn(g))if(x!==ref(g.c0,g.r0)&&tab.cells[x])lose.push(x);
  if(lose.length&&!await confirm({title:'Merge cells?',message:'Merging keeps only the upper-left value of each merged group. The other values are removed.',confirm:'Merge',danger:false}))return;
  setTab(tab.id,t=>{const cells={...t.cells};for(const x of lose)delete cells[x];return {...t,cells,merges:[...keep(t),...groups.map(g=>`${ref(g.c0,g.r0)}:${ref(g.c1,g.r1)}`)]};});
  setAnchor([b.c1,b.r1]);setSel([b.c0,b.r0]);
 }
 // ---------- Borders ----------
 function applyBorders(mode:'all'|'inner'|'horizontal'|'vertical'|'outer'|'left'|'top'|'right'|'bottom'|'clear'){
  if(!canEdit)return;const line=`${bdLine} ${bdColor}`;
  const b={...box,r1:box.r1-box.r0>=ROWS-1||box.r1===ROWS-1&&box.r0===0?Math.max(used.mr,box.r0):box.r1,c1:box.c0===0&&box.c1===COLS-1?Math.max(used.mc,box.c0):box.c1};
  setTab(tab.id,t=>{const st={...(t.style??{})};
   const put=(x:string,fn:(bd:NonNullable<Style['bd']>)=>void)=>{const bd={...(st[x]?.bd??{})};fn(bd);const ns:Style={...(st[x]??{}),bd};if(!Object.keys(bd).length)delete ns.bd;if(Object.keys(ns).length)st[x]=ns;else delete st[x];};
   for(let r=b.r0;r<=b.r1;r++)for(let c=b.c0;c<=b.c1;c++)put(ref(c,r),bd=>{
    if(mode==='clear'){delete bd.t;delete bd.r;delete bd.b;delete bd.l;return;}
    const top=r===b.r0?['all','outer','top'].includes(mode):['all','inner','horizontal'].includes(mode);
    const left=c===b.c0?['all','outer','left'].includes(mode):['all','inner','vertical'].includes(mode);
    if(top)bd.t=line;if(left)bd.l=line;if(r===b.r1&&['all','outer','bottom'].includes(mode))bd.b=line;if(c===b.c1&&['all','outer','right'].includes(mode))bd.r=line;});
   if(mode==='clear'){if(b.r0>0)for(let c=b.c0;c<=b.c1;c++)put(ref(c,b.r0-1),bd=>{delete bd.b;});if(b.r1<ROWS-1)for(let c=b.c0;c<=b.c1;c++)put(ref(c,b.r1+1),bd=>{delete bd.t;});
    if(b.c0>0)for(let r=b.r0;r<=b.r1;r++)put(ref(b.c0-1,r),bd=>{delete bd.r;});if(b.c1<COLS-1)for(let r=b.r0;r<=b.r1;r++)put(ref(b.c1+1,r),bd=>{delete bd.l;});}
   return {...t,style:st};});
 }
 // ---------- Conditional formatting ----------
 const cfs=useMemo(()=>(tab.cf??[]).map(x=>({x,b:parseRange(x.range)})).filter((y):y is {x:CfRule;b:Box}=>!!y.b),[tab.cf]);
 const cfEval=useMemo(()=>cfs.some(y=>y.x.cond==='formula')?exprEval(tab,tabs):null,[cfs,tab,tabs]);
 const cfScale=useMemo(()=>{const out:Record<string,{lo:number;hi:number}>={};for(const {x,b} of cfs){if(!x.scale)continue;let lo=Infinity,hi=-Infinity;
   for(let r=b.r0;r<=Math.min(b.r1,used.mr);r++)for(let c=b.c0;c<=Math.min(b.c1,used.mc);c++){const v=values[ref(c,r)];if(typeof v==='number'){lo=Math.min(lo,v);hi=Math.max(hi,v);}}
   if(lo<=hi)out[x.id]={lo,hi};}return out;},[cfs,values,used.mr,used.mc]);
 function cfFor(c:number,r:number,x:string,v:unknown):React.CSSProperties|undefined{
  for(const {x:rule,b} of cfs){if(c<b.c0||c>b.c1||r<b.r0||r>b.r1)continue;
   if(rule.scale){const st2=cfScale[rule.id];if(typeof v!=='number'||!st2)continue;const f=st2.hi===st2.lo?1:(v-st2.lo)/(st2.hi-st2.lo);
    const bg=rule.scale.mid?(f<.5?mix(rule.scale.min,rule.scale.mid,f*2):mix(rule.scale.mid,rule.scale.max,(f-.5)*2)):mix(rule.scale.min,rule.scale.max,f);return {background:bg,color:chipInk(bg)};}
   if(cfTest(rule,v,tab.style?.[x],()=>cfEval?cfEval(shiftRefs(`=${(rule.a??'').replace(/^=/,'')}`,c-b.c0,r-b.r0)):false)){const f=rule.fmt??{};
    return {...(f.bg?{background:f.bg}:{}),...(f.color?{color:f.color}:f.bg?{color:chipInk(f.bg)}:{}),...(f.b?{fontWeight:700}:{}),...(f.i?{fontStyle:'italic'}:{}),...(f.s||f.u?{textDecoration:[f.u?'underline':'',f.s?'line-through':''].join(' ').trim()}:{})};}}
  return undefined;}
 // ---------- Notes, comments ----------
 const notes=tab.notes??{},comments=tab.comments??{};
 function saveNote(x:string,t:string){setNoteEdit(null);if(!canEdit)return;const v=t.trim();if((notes[x]??'')===v)return;setTab(tab.id,tb=>{const n={...(tb.notes??{})};if(v)n[x]=v.slice(0,5000);else delete n[x];return {...tb,notes:n};});gridRef.current?.focus();}
 const putCmt=(x:string,fn:(c:Cmt|undefined)=>Cmt|undefined)=>setTab(tab.id,tb=>{const all={...(tb.comments??{})};const n=fn(all[x]);if(n)all[x]=n;else delete all[x];return {...tb,comments:all};});
 function addComment(x:string,t:string){const v=t.trim().slice(0,4000);if(!v)return;const at=new Date().toISOString();
  putCmt(x,c=>c&&!c.done?{...c,re:[...(c.re??[]),{u:me.user_id,t:v,at}]}:{id:newId(),u:me.user_id,t:v,at});}
 const openCmts=Object.entries(comments).filter(([,c])=>!c.done);
 // ---------- Charts and pictures over the grid ----------
 const objs=tab.objs??[];
 const putObj=(id:string,fn:(o:Obj)=>Obj|null)=>setTab(tab.id,tb=>({...tb,objs:(tb.objs??[]).flatMap(o=>{if(o.id!==id)return [o];const n=fn(o);return n?[n]:[];})}));
 function insertChart(){if(!canEdit)return;
  const b=box.c0!==box.c1||box.r0!==box.r1?{...box,r1:Math.min(box.r1,Math.max(used.mr,box.r0))}:{c0:0,c1:Math.max(0,used.mc),r0:0,r1:Math.max(0,used.mr)};
  const firstRowText=keysIn({...b,r1:b.r0}).some(x=>{const v=values[x];return typeof v==='string'&&v!=='';});
  const firstColText=b.r1>b.r0&&keysIn({...b,c1:b.c0,r0:b.r0+1}).some(x=>{const v=values[x];return typeof v==='string'&&v!=='';});
  const o:Obj={id:newId(),kind:'chart',type:'column',range:`${ref(b.c0,b.r0)}:${ref(b.c1,b.r1)}`,x:leftOf(Math.min(COLS-1,b.c1+1))+16,y:HEAD_H+Math.max(0,vIndex[b.r0])*ROW_H,w:520,h:320,...(firstRowText?{head:1 as const}:{}),...(firstColText?{lab:1 as const}:{}),title:''};
  setTab(tab.id,tb=>({...tb,objs:[...(tb.objs??[]),o]}));setObjSel(o.id);setChartEdit(o.id);}
 async function insertImage(file:File){if(!canEdit)return;setImgBusy(true);
  try{const url=await uploadEditorImage(file,'doc',id);
   if(imgMode.current==='cell')setCells([{tab:tab.id,k,v:`=IMAGE("${url.replace(/"/g,'""')}")`}]);
   else{const dim=await new Promise<{w:number;h:number}>(res=>{const im=new Image();im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight});im.onerror=()=>res({w:400,h:300});im.src=url;});
    const sc=Math.min(1,420/dim.w,320/dim.h),o:Obj={id:newId(),kind:'image',src:url,x:leftOf(sel[0])+8,y:HEAD_H+Math.max(0,vIndex[sel[1]])*ROW_H+8,w:Math.round(dim.w*sc),h:Math.round(dim.h*sc)};
    setTab(tab.id,tb=>({...tb,objs:[...(tb.objs??[]),o]}));setObjSel(o.id);}}
  catch(e){flash(e instanceof Error?e.message:'Could not upload the picture.');}finally{setImgBusy(false);}}
 const pickImage=(mode:'cell'|'over')=>{imgMode.current=mode;imgIn.current?.click();};
 useEffect(()=>{
  const mv=(e:MouseEvent)=>{const d=objDrag.current;if(!d)return;const dx=(e.clientX-d.sx)/zoom,dy=(e.clientY-d.sy)/zoom;
   setObjDraft(d.mode==='move'?{id:d.id,...d.o,x:Math.max(ROWHEAD_W,Math.round(d.o.x+dx)),y:Math.max(HEAD_H,Math.round(d.o.y+dy))}:{id:d.id,...d.o,w:Math.max(120,Math.round(d.o.w+dx)),h:Math.max(80,Math.round(d.o.h+dy))});};
  const up=()=>{const d=objDrag.current;objDrag.current=null;setObjDraft(dr=>{if(d&&dr&&dr.id===d.id&&(dr.x!==d.o.x||dr.y!==d.o.y||dr.w!==d.o.w||dr.h!==d.o.h))putObj(d.id,o=>({...o,x:dr.x,y:dr.y,w:dr.w,h:dr.h}));return null;});};
  window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);return()=>{window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);};
 });
 // ---------- Links ----------
 function saveLink(text:string,url:string){setLinkEdit(null);if(!canEdit)return;const u=url.trim(),t2=text.trim();
  const v=!u?t2:t2&&t2!==u?`=HYPERLINK("${u.replace(/"/g,'""')}","${t2.replace(/"/g,'""')}")`:u;setCells([{tab:tab.id,k,v}]);gridRef.current?.focus();}
 function openLinkEditor(){if(!canEdit)return;const raw=tab.cells[k]??'',shown=show(values[k],st);const u=linkOf(raw,shown);setLinkEdit({text:shown,url:u??''});}
 // ---------- Checkboxes and dropdowns (data validation) ----------
 const rules=useMemo(()=>(tab.valid??[]).map(x=>({x,b:parseRange(x.range)})).filter((y):y is {x:Rule;b:Box}=>!!y.b),[tab.valid]);
 const ruleOf=(c:number,r:number)=>{for(let i=rules.length-1;i>=0;i--){const {x,b}=rules[i];if(c>=b.c0&&c<=b.c1&&r>=b.r0&&r<=b.r1)return x;}return undefined;};
 const isTrue=(raw?:string)=>(raw??'').trim().toUpperCase()==='TRUE';
 const rangeOf=(b:Box)=>b.c0===b.c1&&b.r0===b.r1?ref(b.c0,b.r0):`${ref(b.c0,b.r0)}:${ref(b.c1,b.r1)}`;
 const flash=(m:string)=>{setWarn(m);setTimeout(()=>setWarn(w=>w===m?'':w),2800);};
 // Every change is checked here first: pivot tabs can't be typed into, and protected ranges only change for the people allowed.
 guard.current=(a,b)=>{
  if(preview)return {block:'You’re looking at an earlier version. Go back to the current version to edit.'};
  let warnMe=false;
  for(const t of b.tabs){const o=a.tabs.find(x=>x.id===t.id);if(!o||o===t)continue;
   if(o.pivot&&t.cells!==o.cells&&Object.keys(t.cells).length)return {block:'This is a pivot table. Change it in the pivot table editor.'};
   for(const pr of o.prot??[]){if(role==='owner'||pr.by===me.user_id||pr.eds?.includes(me.user_id))continue;let hit=false;
    if(!pr.range)hit=t.cells!==o.cells||t.style!==o.style||t.merges!==o.merges||t.valid!==o.valid||t.cf!==o.cf||t.objs!==o.objs||t.hRows!==o.hRows||t.hCols!==o.hCols||t.widths!==o.widths||t.filter!==o.filter;
    else{const bx=parseRange(pr.range);if(bx){const inside=(x:string)=>{const q=parseRef(x);return !!q&&q[0]>=bx.c0&&q[0]<=bx.c1&&q[1]>=bx.r0&&q[1]<=bx.r1;};
     if(t.cells!==o.cells)for(const x of new Set([...Object.keys(o.cells),...Object.keys(t.cells)]))if(o.cells[x]!==t.cells[x]&&inside(x)){hit=true;break;}
     if(!hit&&t.style!==o.style)for(const x of new Set([...Object.keys(o.style??{}),...Object.keys(t.style??{})]))if(inside(x)&&JSON.stringify(o.style?.[x])!==JSON.stringify(t.style?.[x])){hit=true;break;}}}
    if(hit){if(!pr.warn)return {block:`${pr.desc?`“${pr.desc}” is`:pr.range?'These cells are':'This tab is'} protected. Ask ${people[pr.by]?.display_name?.split(' ')[0]??'the owner'} if it needs changing.`};warnMe=true;}}}
  return warnMe?{warn:true}:null;};
 // A pivot table goes on a new tab, built from the selection (or all the data on this tab, heading row first).
 function insertPivot(){if(!canEdit)return;if(tab.pivot){flash('Pick the data on a normal tab first.');return;}let b:Box;
  if(box.c0!==box.c1||box.r0!==box.r1)b={...box};
  else{if(used.mc<0){flash('Add some data with a heading row first.');return;}let top=ROWS;for(const x of Object.keys(tab.cells)){const q=parseRef(x);if(q)top=Math.min(top,q[1]);}b={c0:0,c1:used.mc,r0:top,r1:used.mr};}
  const n=blankTab();let i=1;while(latest.current.data.tabs.some(x=>x.name===`Pivot table ${i}`))i++;n.name=`Pivot table ${i}`;
  n.pivot={src:tab.id,range:`${ref(b.c0,b.r0)}:${ref(b.c1,b.r1)}`,rows:[],cols:[],vals:[]};
  commit({tabs:[...latest.current.data.tabs,n]});setTabId(n.id);setSel([0,0]);setAnchor(null);setPivOpen(true);}
 async function restoreVersion(d:SheetData,label:string){
  if(!await confirm({title:'Restore this version?',message:`The sheet goes back to how it was (${label}). The current version is kept in version history, so you can switch back.`,confirm:'Restore',danger:false}))return;
  snapAt.current=0;setPreview(null);commit(d,undefined,true,true);if(!d.tabs.some(t=>t.id===tabId))setTabId(d.tabs[0].id);flash('Version restored');}
 function toggleChecks(keys:string[]){const ks=keys.filter(x=>{const p=parseRef(x);return p&&ruleOf(p[0],p[1])?.t==='check';});if(!ks.length||!canEdit)return false;
  const on=!ks.every(x=>isTrue(tab.cells[x]));setCells(ks.map(x=>({tab:tab.id,k:x,v:on?'TRUE':'FALSE'})));return true;}
 function saveRule(rule:Rule){if(!canEdit)return;setTab(tab.id,t=>({...t,valid:[...(t.valid??[]).filter(x=>x.id!==rule.id),rule]}));}
 function dropRule(id:string){setTab(tab.id,t=>({...t,valid:(t.valid??[]).filter(x=>x.id!==id)}));}
 // Removing validation from a selection takes off every checkbox/dropdown rule that touches it.
 function clearRules(){if(!canEdit)return;setTab(tab.id,t=>({...t,valid:(t.valid??[]).filter(x=>{const b=parseRange(x.range);return !b||b.c1<box.c0||b.c0>box.c1||b.r1<box.r0||b.r0>box.r1;})}));}
 function addCheckbox(){if(!canEdit)return;saveRule({id:newId(),range:rangeOf(box),t:'check'});}
 // A new dropdown starts from the values already in the selection, like Google Sheets does.
 function openDropdown(){if(!canEdit)return;const cur=ruleOf(sel[0],sel[1]);if(cur){setRuleEdit(cur);return;}
  const seen:string[]=[];for(const x of keysIn(box)){const v=(tab.cells[x]??'').trim();if(v&&!v.startsWith('=')&&!seen.some(y=>y.toLowerCase()===v.toLowerCase())&&seen.length<30)seen.push(v);}
  const opts=(seen.length?seen:['Option 1','Option 2']).map((v,i)=>({v,c:CHIP_COLORS[i%8]}));
  setRuleEdit({id:newId(),range:rangeOf(box),t:'list',opts});}
 const pickOpt=(x:string,v:string)=>{setDd(null);if(canEdit&&(tab.cells[x]??'')!==v)setCells([{tab:tab.id,k:x,v}]);gridRef.current?.focus();};

 // ---------- Editing ----------
 const startEdit=(v:string,mode:'type'|'edit',where:'cell'|'bar'='cell')=>{if(!canEdit)return;if(mode==='edit'&&(tab.style?.[k]?.fmt==='date')&&/^\d+(\.\d+)?$/.test(v))v=show(Number(v),{fmt:'date'});setEditing(v);setEditMode(mode);setEditIn(where);setPick(0);};
 const commitEdit=(raw:string|null=editing)=>{if(raw===null)return;let v=raw;const typed=raw.trim().toLowerCase();
  // Dates: a date-formatted cell takes any readable date; elsewhere a clearly typed date (18/11/2026, 2026-11-18, 18 Nov 2026) becomes one.
  if(!v.startsWith('=')&&v.trim()){const isDate=tab.style?.[k]?.fmt==='date',clear=/^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}|\d{1,2}\s+[a-z]{3,9}\.?\s+\d{4}|[a-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})$/i.test(v.trim());
   if((isDate||(clear&&!tab.style?.[k]?.fmt))&&!ruleOf(sel[0],sel[1])){const n=parseDateText(v);if(n!==null){v=String(n);if(!isDate&&canEdit)styleKeys([k],s2=>({...s2,fmt:'date'}));}}}
  const rl=ruleOf(sel[0],sel[1]);
  if(rl?.t==='list'&&typed&&!v.startsWith('=')){const hit=rl.opts?.find(o=>o.v.toLowerCase()===typed);if(hit)v=hit.v;else if(rl.strict){flash(`“${v.trim()}” isn't one of the options for this cell.`);setEditing(null);gridRef.current?.focus();return;}}
  if(canEdit&&(tab.cells[k]??'')!==v)setCells([{tab:tab.id,k,v}]);setEditing(null);gridRef.current?.focus();};
 const move=(dc:number,dr:number,extend=false)=>{if(extend&&!anchor)setAnchor(sel);if(!extend)setAnchor(null);
  const cm=mergeAt(sel[0],sel[1]);const t=[stepC(dc>0&&cm?cm.c1:sel[0],dc),stepR(dr>0&&cm?cm.r1:sel[1],dr)] as [number,number];
  const tm=extend?undefined:mergeAt(t[0],t[1]);if(tm){setSel([tm.c0,tm.r0]);setAnchor([tm.c1,tm.r1]);}else setSel(t);};
 useEffect(()=>{if(editing!==null)(editIn==='cell'?cellIn:barIn).current?.focus();},[editing===null,editIn]); // eslint-disable-line react-hooks/exhaustive-deps
 // Formula help: suggestions while typing a function name, and the signature of the function you're inside.
 const fx=useMemo(()=>{
  if(editing===null||!editing.startsWith('='))return {list:[] as string[],token:'',help:''};
  const m=/(?:^=|[(,;+\-*/^&=<>:\s])([A-Za-z]{1,})$/.exec(editing);const token=m?m[1]:'';
  const list=token?FUNCTION_NAMES.filter(n=>n.startsWith(token.toUpperCase())&&n!==token.toUpperCase()).slice(0,8):[];
  let depth=0,name='';for(let i=editing.length-1;i>=0;i--){const ch=editing[i];if(ch===')')depth++;else if(ch==='('){if(depth===0){const mm=/([A-Za-z]+)$/.exec(editing.slice(0,i));name=mm?mm[1].toUpperCase():'';break;}depth--;}}
  return {list,token,help:FUNCTIONS[name]?.help??''};
 },[editing]);
 const acceptFx=(n:string)=>{if(editing===null)return;setEditing(editing.slice(0,editing.length-fx.token.length)+n+'(');setPick(0);};
 // While typing a formula, clicking a cell drops its reference in (drag for a range).
 const pointing=editing!==null&&editing.startsWith('=')&&/[=(,;+\-*/^&<>:]$/.test(editing);

 // ---------- Formatting ----------
 const styleKeys=(keys:string[],patch:(s:Style)=>Style)=>{if(!canEdit)return;setTab(tab.id,t=>{const s={...(t.style??{})};for(const x of keys){const n=patch({...(s[x]??{})});for(const p of Object.keys(n) as (keyof Style)[])if(n[p]===undefined)delete n[p];if(Object.keys(n).length)s[x]=n;else delete s[x];}return {...t,style:s};});};
 const toggle=(p:'b'|'i'|'u'|'s')=>{const keys=keysIn(box),on=!keys.every(x=>tab.style?.[x]?.[p]);styleKeys(keys,s=>({...s,[p]:on?1:undefined}));};
 const setFmt=(fmt:Style['fmt'],cur?:string)=>styleKeys(keysIn(box),s=>({...s,fmt:fmt==='auto'?undefined:fmt,cur:fmt==='cur'?cur??'₦':undefined}));
 const bump=(d:number)=>styleKeys(keysIn(box),s=>({...s,dec:Math.max(0,Math.min(10,(s.dec??(s.fmt==='cur'||s.fmt==='pct'||s.fmt==='num'?2:0))+d))}));

 // ---------- Clipboard ----------
 function copyBox(cut:boolean){const cells:Record<string,string>={},style:Record<string,Style>={};const lines:string[]=[];
  for(let r=box.r0;r<=box.r1;r++){const cols:string[]=[];for(let c=box.c0;c<=box.c1;c++){const x=ref(c,r),rel=ref(c-box.c0,r-box.r0);if(tab.cells[x])cells[rel]=tab.cells[x];if(tab.style?.[x])style[rel]=tab.style[x];cols.push(show(values[x],tab.style?.[x]));}lines.push(cols.join('\t'));}
  const text=lines.join('\n');clip.current={cells,style,box:{...box},cut,text};return text;}
 function pasteAt(text:string){
  if(!canEdit)return;const c0=box.c0,r0=box.r0;
  const own=clip.current&&clip.current.text===text?clip.current:null;
  const edits:Edit[]=[];const styles:Record<string,Style|null>={};
  if(own){const h=own.box.r1-own.box.r0,w=own.box.c1-own.box.c0;
   if(own.cut)for(let r=own.box.r0;r<=own.box.r1;r++)for(let c=own.box.c0;c<=own.box.c1;c++){const x=ref(c,r);if(tab.cells[x])edits.push({tab:tab.id,k:x,v:''});styles[x]=null;}
   for(let r=0;r<=h;r++)for(let c=0;c<=w;c++){const rel=ref(c,r),to=ref(c0+c,r0+r);if(c0+c>=COLS||r0+r>=ROWS)continue;
    const raw=own.cells[rel]??'';const v=own.cut?raw:shiftRefs(raw,c0-own.box.c0,r0-own.box.r0);
    const i=edits.findIndex(e=>e.k===to);if(i>=0)edits.splice(i,1);edits.push({tab:tab.id,k:to,v});styles[to]=own.style[rel]??null;}
   if(own.cut)clip.current=null;
  }else text.replace(/\r/g,'').replace(/\n$/,'').split('\n').forEach((line,dr)=>line.split('\t').forEach((v,dc)=>{if(c0+dc<COLS&&r0+dr<ROWS)edits.push({tab:tab.id,k:ref(c0+dc,r0+dr),v});}));
  let next=applyEdits(latest.current.data,edits);
  if(Object.keys(styles).length)next={tabs:next.tabs.map(t=>{if(t.id!==tab.id)return t;const s={...(t.style??{})};for(const [x,v] of Object.entries(styles)){if(v)s[x]=v;else delete s[x];}return {...t,style:s};})};
  commit(next);
 }
 const onCopy=(e:React.ClipboardEvent|ClipboardEvent,cut=false)=>{if(editing!==null)return;e.preventDefault();const t=copyBox(cut);if(clip.current)clip.current.text=t;e.clipboardData?.setData('text/plain',t);};
 const onPaste=(e:React.ClipboardEvent)=>{if(editing!==null)return;e.preventDefault();pasteAt(e.clipboardData.getData('text/plain'));};
 async function menuCopy(cut:boolean){const t=copyBox(cut);if(clip.current)clip.current.text=t;try{await navigator.clipboard.writeText(t);}catch{}}
 async function menuPaste(){try{pasteAt(await navigator.clipboard.readText());}catch{if(clip.current)pasteAt(clip.current.text);}}

 // ---------- Fill (handle drag, Ctrl+D, Ctrl+R) ----------
 function fillTo(to:[number,number]){
  if(!canEdit)return;const down=Math.abs(to[1]-box.r1)>=Math.abs(to[0]-box.c1)?1:0;const edits:Edit[]=[];const styles:Record<string,Style|undefined>={};
  if(down){const h=box.r1-box.r0+1;const from=to[1]>box.r1?box.r1+1:to[1],end=to[1]>box.r1?to[1]:box.r0-1;
   for(let r=from;r<=end;r++)for(let c=box.c0;c<=box.c1;c++){const src=box.r0+(((r-box.r0)%h)+h)%h;const raw=tab.cells[ref(c,src)]??'';edits.push({tab:tab.id,k:ref(c,r),v:shiftRefs(raw,0,r-src)});styles[ref(c,r)]=tab.style?.[ref(c,src)];}}
  else{const w=box.c1-box.c0+1;const from=to[0]>box.c1?box.c1+1:to[0],end=to[0]>box.c1?to[0]:box.c0-1;
   for(let c=from;c<=end;c++)for(let r=box.r0;r<=box.r1;r++){const src=box.c0+(((c-box.c0)%w)+w)%w;const raw=tab.cells[ref(src,r)]??'';edits.push({tab:tab.id,k:ref(c,r),v:shiftRefs(raw,c-src,0)});styles[ref(c,r)]=tab.style?.[ref(src,r)];}}
  let next=applyEdits(latest.current.data,edits);
  next={tabs:next.tabs.map(t=>{if(t.id!==tab.id)return t;const s={...(t.style??{})};for(const [x,v] of Object.entries(styles)){if(v)s[x]=v;else delete s[x];}return {...t,style:s};})};
  commit(next);
  if(down){setAnchor([box.c0,Math.min(box.r0,to[1])]);setSel([box.c1,Math.max(box.r1,to[1])]);}else{setAnchor([Math.min(box.c0,to[0]),box.r0]);setSel([Math.max(box.c1,to[0]),box.r1]);}
 }
 function fillDown(right:boolean){if(!canEdit)return;const edits:Edit[]=[];
  if(right){for(let r=box.r0;r<=box.r1;r++){const raw=tab.cells[ref(box.c0,r)]??'';for(let c=box.c0+1;c<=box.c1;c++)edits.push({tab:tab.id,k:ref(c,r),v:shiftRefs(raw,c-box.c0,0)});}}
  else{for(let c=box.c0;c<=box.c1;c++){const raw=tab.cells[ref(c,box.r0)]??'';for(let r=box.r0+1;r<=box.r1;r++)edits.push({tab:tab.id,k:ref(c,r),v:shiftRefs(raw,0,r-box.r0)});}}
  setCells(edits);}

 // ---------- Rows, columns, sorting ----------
 function shift(axis:'r'|'c',at:number,delta:number){
  if(!canEdit)return;
  setTab(tab.id,t=>{const move=<T,>(m:Record<string,T>|undefined)=>{const out:Record<string,T>={};for(const [x,v] of Object.entries(m??{})){const p=parseRef(x);if(!p)continue;let [c,r]=p;
     if(axis==='r'){if(delta<0&&r>=at&&r<at-delta)continue;if(r>=at)r+=delta;}else{if(delta<0&&c>=at&&c<at-delta)continue;if(c>=at)c+=delta;}
     if(c>=0&&c<COLS&&r>=0&&r<ROWS)out[ref(c,r)]=v;}return out;};
   const cells=move(t.cells);for(const x of Object.keys(cells))cells[x]=adjustRefs(cells[x],axis,at,delta);
   let widths=t.widths;if(axis==='c'&&widths){const w:Record<string,number>={};for(const [c,v] of Object.entries(widths)){let n=Number(c);if(delta<0&&n>=at&&n<at-delta)continue;if(n>=at)n+=delta;w[n]=v;}widths=w;}
   const valid=t.valid?.map(x=>({...x,range:adjustRefs(`=${x.range}`,axis,at,delta).slice(1)})).filter(x=>!x.range.includes('#REF!'));
   const mv=(arr:number[]|undefined,ax:'r'|'c')=>arr?.flatMap(n=>ax!==axis?[n]:delta<0&&n>=at&&n<at-delta?[]:[n>=at?n+delta:n]);
   let filter=t.filter;if(filter){const range=adjustRefs(`=${filter.range}`,axis,at,delta).slice(1);if(range.includes('#REF!'))filter=undefined;else{let hide=filter.hide;if(axis==='c'){hide={};for(const [c,v] of Object.entries(filter.hide)){let n=Number(c);if(delta<0&&n>=at&&n<at-delta)continue;if(n>=at)n+=delta;hide[n]=v;}}filter={range,hide};}}
   const adj=(x:string)=>adjustRefs(`=${x}`,axis,at,delta).slice(1);const merges2=t.merges?.map(adj).filter(x=>!x.includes('#REF!'));const cf2=t.cf?.map(x=>({...x,range:adj(x.range)})).filter(x=>!x.range.includes('#REF!'));
   const out:Tab={...t,cells,style:move(t.style),...(t.notes?{notes:move(t.notes)}:{}),...(t.comments?{comments:move(t.comments)}:{}),widths,...(merges2?{merges:merges2}:{}),...(cf2?{cf:cf2}:{}),...(valid?{valid}:{}),...(t.hRows?{hRows:mv(t.hRows,'r')}:{}),...(t.hCols?{hCols:mv(t.hCols,'c')}:{})};if(filter)out.filter=filter;else delete out.filter;return out;});
 }
 function sort(dir:1|-1,whole:boolean){
  if(!canEdit)return;
  // Inside a filter, sorting the whole sheet sorts the filter's rows and keeps its header row on top.
  if(whole&&filt&&sel[0]>=filt.b.c0&&sel[0]<=filt.b.c1)return sortRange({...filt.b,r0:filt.b.r0+1,r1:Math.min(filt.b.r1,Math.max(used.mr,filt.b.r0+1))},sel[0],dir);
  sortRange(whole||(box.r0===box.r1&&box.c0===box.c1)?{r0:0,r1:Math.max(0,used.mr),c0:0,c1:Math.max(0,used.mc)}:box,sel[0],dir);}
 function sortRange(b:Box,col:number,dir:1|-1){
  const rows:{cells:Record<number,string>;style:Record<number,Style>;key:unknown}[]=[];
  for(let r=b.r0;r<=b.r1;r++){const cells:Record<number,string>={},style:Record<number,Style>={};for(let c=b.c0;c<=b.c1;c++){const x=ref(c,r);if(tab.cells[x])cells[c]=tab.cells[x];if(tab.style?.[x])style[c]=tab.style[x];}rows.push({cells,style,key:values[ref(col,r)]});}
  const val=(v:unknown)=>v===undefined||v===''?null:v;
  rows.sort((a,z)=>{const x=val(a.key),y=val(z.key);if(x===null&&y===null)return 0;if(x===null)return 1;if(y===null)return -1;
   if(typeof x==='number'&&typeof y==='number')return (x-y)*dir;return String(x).localeCompare(String(y),undefined,{numeric:true})*dir;});
  setTab(tab.id,t=>{const cells={...t.cells},style={...(t.style??{})};
   for(let r=b.r0;r<=b.r1;r++)for(let c=b.c0;c<=b.c1;c++){delete cells[ref(c,r)];delete style[ref(c,r)];}
   rows.forEach((rw,i)=>{for(const [c,v] of Object.entries(rw.cells))cells[ref(Number(c),b.r0+i)]=v;for(const [c,v] of Object.entries(rw.style))style[ref(Number(c),b.r0+i)]=v;});
   return {...t,cells,style};});
 }
 const undo=()=>{const p=hist.current.past.pop();if(!p)return;hist.current.future.push(latest.current.data);commit(p,undefined,false);};
 const redo=()=>{const n=hist.current.future.pop();if(!n)return;hist.current.past.push(latest.current.data);commit(n,undefined,false);};

 // ---------- Keyboard ----------
 function onKey(e:React.KeyboardEvent){
  if(editing!==null||renamingTab)return;
  // Keys typed in a note, comment or other box inside the grid belong to that box.
  if(e.target!==e.currentTarget&&(e.target as HTMLElement).closest('textarea,input,select'))return;
  if(objSel){if((e.key==='Delete'||e.key==='Backspace')&&canEdit){e.preventDefault();putObj(objSel,()=>null);setObjSel(null);return;}if(e.key==='Escape'){setObjSel(null);return;}}
  if(e.key==='F2'&&e.shiftKey){e.preventDefault();if(canEdit)setNoteEdit(k);return;}
  if((e.metaKey||e.ctrlKey)&&e.altKey&&e.key.toLowerCase()==='m'){e.preventDefault();setCmtOpen(k);return;}
  const mod=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();
  if(mod&&key==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
  if(mod&&key==='y'){e.preventDefault();redo();return;}
  if(mod&&key==='b'){e.preventDefault();toggle('b');return;}if(mod&&key==='i'){e.preventDefault();toggle('i');return;}if(mod&&key==='u'){e.preventDefault();toggle('u');return;}
  if(mod&&key==='d'){e.preventDefault();fillDown(false);return;}if(mod&&key==='r'){e.preventDefault();fillDown(true);return;}
  if(mod&&key==='a'){e.preventDefault();setAnchor([COLS-1,ROWS-1]);setSel([0,0]);return;}
  if(mod&&key==='k'){e.preventDefault();openLinkEditor();return;}
  if(mod&&key==='f'){e.preventDefault();setFind({q:'',rep:'',at:-1});return;}
  if(mod&&key==='/'){e.preventDefault();setHelp('keys');return;}
  if(mod&&e.key==='Home'){e.preventDefault();setAnchor(null);setSel([0,0]);return;}
  const jump=(dc:number,dr:number)=>{if(!mod)return move(dc,dr,e.shiftKey);const tc=dc>0?Math.max(used.mc,sel[0]):dc<0?0:sel[0],tr=dr>0?Math.max(used.mr,sel[1]):dr<0?0:sel[1];if(e.shiftKey&&!anchor)setAnchor(sel);if(!e.shiftKey)setAnchor(null);setSel([tc,tr]);};
  if(e.key==='ArrowUp'){e.preventDefault();jump(0,-1);}else if(e.key==='ArrowDown'){e.preventDefault();jump(0,1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();jump(-1,0);}else if(e.key==='ArrowRight'){e.preventDefault();jump(1,0);}
  else if(e.key==='Tab'){e.preventDefault();move(e.shiftKey?-1:1,0);}
  else if(e.key===' '&&!mod&&toggleChecks(keysIn(box))){e.preventDefault();}
  else if((e.key==='Enter'&&!e.shiftKey||e.altKey&&e.key==='ArrowDown')&&ruleOf(sel[0],sel[1])?.t==='list'&&canEdit){e.preventDefault();setDd(k);}
  else if(e.key==='Enter'&&ruleOf(sel[0],sel[1])?.t==='check'){e.preventDefault();toggleChecks([k]);}
  else if(e.key==='Enter'){e.preventDefault();if(e.shiftKey)move(0,-1);else startEdit(tab.cells[k]??'','edit');}
  else if(e.key==='F2'){e.preventDefault();startEdit(tab.cells[k]??'','edit');}
  else if((e.key==='Delete'||e.key==='Backspace')&&canEdit){e.preventDefault();setCells(keysIn(box).filter(x=>tab.cells[x]).map(x=>({tab:tab.id,k:x,v:''})));}
  else if(e.key==='Escape'){setAnchor(null);clip.current=null;setDd(null);}
  else if(!mod&&!e.altKey&&e.key.length===1&&canEdit){e.preventDefault();startEdit(e.key,'type');}
 }
 function onEditKey(e:React.KeyboardEvent<HTMLInputElement>){
  if(fx.list.length&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();setPick(p=>(p+(e.key==='ArrowDown'?1:-1)+fx.list.length)%fx.list.length);return;}
  if(fx.list.length&&(e.key==='Tab'||(e.key==='Enter'&&fx.token))){e.preventDefault();acceptFx(fx.list[pick]??fx.list[0]);return;}
  if(e.key==='Enter'){e.preventDefault();commitEdit(e.currentTarget.value);move(0,e.shiftKey?-1:1);}
  else if(e.key==='Tab'){e.preventDefault();commitEdit(e.currentTarget.value);move(e.shiftKey?-1:1,0);}
  else if(e.key==='Escape'){e.preventDefault();setEditing(null);gridRef.current?.focus();}
  else if(editMode==='type'&&!pointing&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();commitEdit(e.currentTarget.value);move(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0);}
 }

 // ---------- Mouse ----------
 function cellDown(e:React.MouseEvent,c:number,r:number){
  setObjSel(null);
  if(e.button===2){if(!(c>=box.c0&&c<=box.c1&&r>=box.r0&&r<=box.r1)){setAnchor(null);setSel([c,r]);}return;}
  if(pointing&&editing!==null){e.preventDefault();const add=ref(c,r);drag.current={kind:'fx',start:[c,r],at:editing.length,len:add.length};setEditing(editing+add);return;}
  if(editing!==null)commitEdit();
  const mg=mergeAt(c,r);if(mg&&!e.shiftKey){setAnchor([mg.c1,mg.r1]);setSel([mg.c0,mg.r0]);drag.current={kind:'sel'};gridRef.current?.focus();return;}
  if(e.shiftKey){if(!anchor)setAnchor(sel);}else setAnchor([c,r]);
  setSel([c,r]);drag.current={kind:'sel'};gridRef.current?.focus();
 }
 function cellEnter(c:number,r:number){
  const d=drag.current;
  if(d.kind==='sel')setSel([c,r]);
  else if(d.kind==='fill')setFill([c,r]);
  else if(d.kind==='fx'&&d.start&&editing!==null){const a=ref(d.start[0],d.start[1]),b=ref(c,r),add=a===b?a:`${ref(Math.min(d.start[0],c),Math.min(d.start[1],r))}:${ref(Math.max(d.start[0],c),Math.max(d.start[1],r))}`;
   setEditing(editing.slice(0,d.at)+add);drag.current={...d,len:add.length};}
 }
 useEffect(()=>{
  const up=()=>{const d=drag.current;if(d.kind==='fill'&&fill)fillTo(fill);if(d.kind==='resize'&&d.col!==undefined&&drafts[d.col]!==undefined){const c=d.col,w=drafts[c];setTab(tab.id,t=>({...t,widths:{...(t.widths??{}),[c]:w}}));setDrafts({});}
   if(d.kind==='fx')(editIn==='cell'?cellIn:barIn).current?.focus();drag.current={kind:null};setFill(null);};
  const mv=(e:MouseEvent)=>{const d=drag.current;if(d.kind==='resize'&&d.col!==undefined)setDrafts({[d.col]:Math.max(30,Math.round((d.w??COL_W)+(e.clientX-(d.x??0))/zoom))});};
  window.addEventListener('mouseup',up);window.addEventListener('mousemove',mv);return()=>{window.removeEventListener('mouseup',up);window.removeEventListener('mousemove',mv);};
 });
 useEffect(()=>{const close=()=>{setMenu(null);setPop(null);setCtx(null);setTabMenu(null);setDd(null);setFpop(null);};window.addEventListener('click',close);return()=>window.removeEventListener('click',close);},[]);

 // ---------- Virtual scrolling: only the rows on screen are drawn ----------
 const rowH=ROW_H*zoom;
 const onScroll=()=>{const el=gridRef.current;if(el)setScroll({top:el.scrollTop,h:el.clientHeight});};
 useEffect(()=>{onScroll();const el=gridRef.current;if(!el)return;const ro=new ResizeObserver(onScroll);ro.observe(el);return()=>ro.disconnect();},[row]);
 const nF=frozenVis.length,first=Math.max(nF,Math.floor(scroll.top/rowH)-6),last=Math.min(vis.length-1,Math.ceil((scroll.top+scroll.h)/rowH)+6);
 useEffect(()=>{const el=gridRef.current;if(!el)return;const vi=Math.max(0,vIndex[sel[1]]),top=(vi+1)*rowH,bottom=top+rowH;const lim=HEAD_H*zoom+nF*rowH;
  if(sel[1]>=freeze.r){if(top-lim<el.scrollTop+0)el.scrollTop=Math.max(0,top-lim);else if(bottom>el.scrollTop+el.clientHeight)el.scrollTop=bottom-el.clientHeight+4;}
  let x=ROWHEAD_W;for(let c=0;c<sel[0];c++)x+=width(c);x*=zoom;let fx2=ROWHEAD_W;for(let c=0;c<freeze.c;c++)fx2+=width(c);fx2*=zoom;const w=width(sel[0])*zoom;
  if(sel[0]>=freeze.c){if(x<el.scrollLeft+fx2)el.scrollLeft=x-fx2;else if(x+w>el.scrollLeft+el.clientWidth)el.scrollLeft=x+w-el.clientWidth+4;}
 },[sel]); // eslint-disable-line react-hooks/exhaustive-deps
 const leftOf=(c:number)=>{let x=ROWHEAD_W;for(let i=0;i<c;i++)x+=width(i);return x;};
 // A merged cell draws its content in a box covering the whole merged area, on top of the cells it hides.
 const wrapMerge=(m:Box|undefined,cur:boolean,css:React.CSSProperties,node:React.ReactNode)=>{if(!m||(m.c0===m.c1&&m.r0===m.r1))return node;
  let w=0;for(let c=m.c0;c<=m.c1;c++)w+=width(c);let h=0;for(let r=m.r0;r<=m.r1;r++)if(!hidden.has(r))h+=ROW_H;
  const {position:_p,left:_l,top:_t,zIndex:_z,...rest}=css;void _p;void _l;void _t;void _z;
  return <div className={`zs2-merge${cur?' is-cur':''}`} style={{...rest,width:w,height:h,justifyContent:css.textAlign==='right'?'flex-end':css.textAlign==='left'||!css.textAlign?'flex-start':'center'}}>{node}</div>;};

 // ---------- Files ----------
 function csvText(){const q=(s:string)=>/[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;const lines:string[]=[];
  for(let r=0;r<=used.mr;r++){const cols:string[]=[];for(let c=0;c<=used.mc;c++)cols.push(q(show(values[ref(c,r)],tab.style?.[ref(c,r)])));lines.push(cols.join(','));}return lines.join('\n');}
 function download(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csvText()],{type:'text/csv'}));a.download=`${(title||'Sheet').replace(/[^\w\- ]+/g,'')} - ${tab.name}.csv`;a.click();URL.revokeObjectURL(a.href);}
 function print(){const w=window.open('','_blank');if(!w)return;const esc=(s:string)=>s.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]!));
  let h=`<html><head><title>${esc(title)} - ${esc(tab.name)}</title><style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse}td{border:1px solid #ccc;padding:3px 6px;white-space:nowrap}</style></head><body><table>`;
  for(let r=0;r<=used.mr;r++){h+='<tr>';for(let c=0;c<=used.mc;c++){const x=ref(c,r),s=tab.style?.[x];h+=`<td style="${s?.b?'font-weight:bold;':''}${s?.i?'font-style:italic;':''}${s?.color?`color:${s.color};`:''}${s?.bg?`background:${s.bg};`:''}${s?.h==='c'?'text-align:center;':s?.h==='r'||typeof values[x]==='number'?'text-align:right;':''}">${esc(show(values[x],s))}</td>`;}h+='</tr>';}
  w.document.write(h+'</table><script>window.onload=()=>{window.print()}<\/script></body></html>');w.document.close();}
 function importCsv(file:File){void file.text().then(txt=>{const rows:string[][]=[];let cur:string[]=[],cell='',q=false;
  for(let i=0;i<txt.length;i++){const ch=txt[i];if(q){if(ch==='"'&&txt[i+1]==='"'){cell+='"';i++;}else if(ch==='"')q=false;else cell+=ch;}else if(ch==='"')q=true;else if(ch===','){cur.push(cell);cell='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&txt[i+1]==='\n')i++;cur.push(cell);rows.push(cur);cur=[];cell='';}else cell+=ch;}
  if(cell||cur.length){cur.push(cell);rows.push(cur);}
  const edits:Edit[]=[];rows.slice(0,ROWS).forEach((rw,r)=>rw.slice(0,COLS).forEach((v,c)=>{if(v!=='')edits.push({tab:tab.id,k:ref(c,r),v});}));setCells(edits);});}
 async function newSheet(){const nid=crypto.randomUUID();const {error}=await db.from('zarn_docs').insert({id:nid,owner_id:me.user_id,title:'Untitled sheet',kind:'sheet',content:JSON.stringify({tabs:[blankTab()]})});if(!error)window.open(`/zarn/sheets/${nid}`,'_blank');}
 async function remove(){if(!await confirm({title:'Move this sheet to the trash?',message:`“${title||'Untitled sheet'}” goes to the Drive trash. You can restore it from there.`,confirm:'Move to trash',danger:true}))return;
  await db.from('zarn_docs').update({trashed_at:new Date().toISOString()}).eq('id',id);router.push(crumbs.at(-1)?.href??'/zarn/drive');}

 // ---------- Tabs ----------
 const addTab=()=>{const t=blankTab(data.tabs.length+1);let n=data.tabs.length+1;while(data.tabs.some(x=>x.name===t.name))t.name=`Sheet${++n}`;commit({tabs:[...data.tabs,t]});setTabId(t.id);setSel([0,0]);setAnchor(null);};
 const dupTab=(t:Tab)=>{const c:Tab={...JSON.parse(JSON.stringify(t)),id:Math.random().toString(36).slice(2,10),name:`Copy of ${t.name}`};const i=data.tabs.findIndex(x=>x.id===t.id);const tabs=[...data.tabs];tabs.splice(i+1,0,c);commit({tabs});setTabId(c.id);};
 const renameTab=(t:Tab,n:string)=>{setRenamingTab(null);const v=n.trim().slice(0,40);if(v&&v!==t.name)setTab(t.id,x=>({...x,name:v}));};
 async function dropTab(t:Tab){if(data.tabs.length<2||!await confirm({title:`Delete “${t.name}”?`,message:'Everything on this tab is removed.',confirm:'Delete tab',danger:true}))return;const rest=data.tabs.filter(x=>x.id!==t.id);commit({tabs:rest});if(tabId===t.id)setTabId(rest[0].id);}

 // ---------- Find & replace ----------
 const fq=find?.q??'';
 const matches=useMemo(()=>{if(!fq)return [] as string[];const q=fq.toLowerCase();return Object.keys(tab.cells).filter(x=>show(values[x],tab.style?.[x]).toLowerCase().includes(q)||tab.cells[x].toLowerCase().includes(q)).sort((a,b)=>{const p=parseRef(a)!,q2=parseRef(b)!;return p[1]-q2[1]||p[0]-q2[0];});},[fq,tab.cells,values,tab.style]);
 const findNext=()=>{if(!find||!matches.length)return;const at=(find.at+1)%matches.length;setFind({...find,at});const p=parseRef(matches[at])!;setAnchor(null);setSel(p);};
 const replaceAll=()=>{if(!find?.q||!canEdit)return;const re=new RegExp(find.q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');setCells(Object.entries(tab.cells).filter(([,v])=>!v.startsWith('=')&&re.test(v)).map(([x,v])=>({tab:tab.id,k:x,v:v.replace(re,find.rep)})));};

 if(row===undefined)return <div className="zn-page"><p className="zn-loading">Loading…</p></div>;
 if(!row||!role)return <div className="zn-page"><div className="zn-empty-state"><h2>Sheet not found</h2><p>It may have been deleted, or it isn’t shared with you.</p><Link className="zn-btn" href="/zarn/drive">Back to Drive</Link></div></div>;

 // ---------- Menus ----------
 type Item={label:string;key?:string;run?:()=>void;off?:boolean;on?:boolean}|'-'|{head:string};
 const fmtItems:Item[]=[{head:'Number'},{label:'Automatic',run:()=>setFmt('auto'),on:!st.fmt},{label:'Number  1,000.12',run:()=>setFmt('num'),on:st.fmt==='num'},{label:'Percent  10.12%',run:()=>setFmt('pct'),on:st.fmt==='pct'},{label:'Currency  ₦1,000.12',run:()=>setFmt('cur','₦'),on:st.fmt==='cur'&&st.cur==='₦'},{label:'Currency  $1,000.12',run:()=>setFmt('cur','$'),on:st.fmt==='cur'&&st.cur==='$'},{label:'Currency  £1,000.12',run:()=>setFmt('cur','£'),on:st.fmt==='cur'&&st.cur==='£'},{label:'Date  18 Nov 2026',run:()=>setFmt('date'),on:st.fmt==='date'},{label:'Plain text',run:()=>setFmt('text'),on:st.fmt==='text'}];
 const menus:Record<string,Item[]>={
  File:[{label:'New sheet',run:()=>void newSheet()},{label:'Import CSV…',run:()=>csvIn.current?.click(),off:!canEdit},'-',{label:'Download as Excel (.xlsx)',run:()=>void sheetToXlsx(tabs,title)},{label:'Download as CSV (this tab)',run:download},'-',{label:'Version history',run:()=>setVerOpen(true)},{label:'Print',key:'⌘P',run:print},'-',{label:'Rename',run:()=>titleIn.current?.focus(),off:!canEdit},...(role==='owner'?[{label:'Share',run:()=>setSharing(true)} as Item,{label:'Move to trash',run:()=>void remove()} as Item]:[])],
  Edit:[{label:'Undo',key:'⌘Z',run:undo,off:!hl.u},{label:'Redo',key:'⌘⇧Z',run:redo,off:!hl.r},'-',{label:'Cut',key:'⌘X',run:()=>void menuCopy(true),off:!canEdit},{label:'Copy',key:'⌘C',run:()=>void menuCopy(false)},{label:'Paste',key:'⌘V',run:()=>void menuPaste(),off:!canEdit},'-',{label:'Delete values',key:'Del',run:()=>setCells(keysIn(box).filter(x=>tab.cells[x]).map(x=>({tab:tab.id,k:x,v:''}))),off:!canEdit},{label:'Fill down',key:'⌘D',run:()=>fillDown(false),off:!canEdit},{label:'Fill right',key:'⌘R',run:()=>fillDown(true),off:!canEdit},'-',{label:'Find and replace',key:'⌘F',run:()=>setFind({q:'',rep:'',at:-1})}],
  View:[{head:'Freeze'},{label:'No rows',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,r:0}})),on:!freeze.r,off:!canEdit},{label:'1 row',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,r:1}})),on:freeze.r===1,off:!canEdit},{label:'2 rows',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,r:2}})),on:freeze.r===2,off:!canEdit},{label:`Up to row ${sel[1]+1}`,run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,r:Math.min(sel[1]+1,20)}})),off:!canEdit},
   {label:'No columns',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,c:0}})),on:!freeze.c,off:!canEdit},{label:'1 column',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,c:1}})),on:freeze.c===1,off:!canEdit},{label:`Up to column ${colName(sel[0])}`,run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,c:Math.min(sel[0]+1,10)}})),off:!canEdit},
   '-',{label:'Gridlines',run:()=>setGrid(g=>!g),on:grid},{label:'Protected ranges',run:()=>setShowProt(v=>!v),on:showProt},'-',{label:`Comments${openCmts.length?` (${openCmts.length})`:''}`,run:()=>setCmtPanel(true)},'-',{label:'Show all hidden rows',run:()=>setTab(tab.id,t=>({...t,hRows:[]})),off:!canEdit||!manualRows.size},{label:'Show all hidden columns',run:()=>setTab(tab.id,t=>({...t,hCols:[]})),off:!canEdit||!hCols.size},'-',{head:'Zoom'},...zooms.map(z=>({label:`${Math.round(z*100)}%`,run:()=>setZoom(z),on:zoom===z}) as Item)],
  Insert:[{label:`Row above`,run:()=>shift('r',box.r0,1),off:!canEdit},{label:'Row below',run:()=>shift('r',box.r1+1,1),off:!canEdit},{label:'Column left',run:()=>shift('c',box.c0,1),off:!canEdit},{label:'Column right',run:()=>shift('c',box.c1+1,1),off:!canEdit},'-',{label:'New tab',run:addTab,off:!canEdit},'-',{label:'Checkbox',run:addCheckbox,off:!canEdit},{label:'Dropdown',run:openDropdown,off:!canEdit},{label:'Date',run:()=>{styleKeys(keysIn(box),s2=>({...s2,fmt:'date'}));startEdit(tab.cells[k]??'','edit');},off:!canEdit},{label:'Link',key:'⌘K',run:openLinkEditor,off:!canEdit},'-',{label:'Chart',run:insertChart,off:!canEdit},{label:'Pivot table',run:insertPivot,off:!canEdit},{label:'Image in cell',run:()=>pickImage('cell'),off:!canEdit},{label:'Image over cells',run:()=>pickImage('over'),off:!canEdit},'-',{label:'Note',key:'⇧F2',run:()=>setNoteEdit(k),off:!canEdit},{label:'Comment',key:'⌘⌥M',run:()=>setCmtOpen(k)},'-',{head:'Function'},...['SUM','AVERAGE','COUNT','MAX','MIN','IF','VLOOKUP'].map(n=>({label:n,run:()=>startEdit(`=${n}(`,'edit'),off:!canEdit}) as Item)],
  Format:[...fmtItems,'-',{head:'Text'},{label:'Bold',key:'⌘B',run:()=>toggle('b'),on:!!st.b,off:!canEdit},{label:'Italic',key:'⌘I',run:()=>toggle('i'),on:!!st.i,off:!canEdit},{label:'Underline',key:'⌘U',run:()=>toggle('u'),on:!!st.u,off:!canEdit},{label:'Strikethrough',run:()=>toggle('s'),on:!!st.s,off:!canEdit},'-',{head:'Alignment'},{label:'Left',run:()=>styleKeys(keysIn(box),s=>({...s,h:'l'})),on:st.h==='l',off:!canEdit},{label:'Centre',run:()=>styleKeys(keysIn(box),s=>({...s,h:'c'})),on:st.h==='c',off:!canEdit},{label:'Right',run:()=>styleKeys(keysIn(box),s=>({...s,h:'r'})),on:st.h==='r',off:!canEdit},{label:'Wrap text',run:()=>styleKeys(keysIn(box),s=>({...s,wrap:s.wrap?undefined:1})),on:!!st.wrap,off:!canEdit},'-',{head:'Merge cells'},{label:'Merge all',run:()=>void mergeCells('all'),off:!canEdit},{label:'Merge horizontally',run:()=>void mergeCells('h'),off:!canEdit},{label:'Merge vertically',run:()=>void mergeCells('v'),off:!canEdit},{label:'Unmerge',run:()=>void mergeCells('un'),off:!canEdit},'-',{label:'Conditional formatting…',run:()=>setCfOpen(true),off:!canEdit},'-',{label:'Clear formatting',key:'⌘\\',run:()=>styleKeys(keysIn(box),()=>({})),off:!canEdit}],
  Data:[filt?{label:'Remove filter',run:removeFilter,off:!canEdit}:{label:'Create a filter',run:createFilter,off:!canEdit},'-',{label:`Sort sheet by column ${colName(sel[0])}, A → Z`,run:()=>sort(1,true),off:!canEdit},{label:`Sort sheet by column ${colName(sel[0])}, Z → A`,run:()=>sort(-1,true),off:!canEdit},'-',{label:'Sort range A → Z',run:()=>sort(1,false),off:!canEdit},{label:'Sort range Z → A',run:()=>sort(-1,false),off:!canEdit},'-',{label:'Dropdown…',run:openDropdown,off:!canEdit},{label:'Checkbox',run:addCheckbox,off:!canEdit},{label:'Remove dropdowns and checkboxes',run:clearRules,off:!canEdit||!rules.length},'-',{label:'Protect sheets and ranges',run:()=>setProtOpen(true),off:!canEdit},{label:'Pivot table',run:insertPivot,off:!canEdit},...(tab.pivot?[{label:'Pivot table editor',run:()=>setPivOpen(true),off:!canEdit} as Item]:[])],
  Help:[{label:'Keyboard shortcuts',key:'⌘/',run:()=>setHelp('keys')},{label:'Function list',run:()=>setHelp('fx')}],
 };
 const renderItems=(items:Item[])=>items.map((it,i)=>it==='-'?<hr key={i}/>:'head' in it?<p key={i} className="zs2-mhead">{it.head}</p>:<button key={i} type="button" disabled={it.off} onClick={()=>{setMenu(null);setCtx(null);it.run?.();}}><span className="zs2-mcheck">{it.on&&<Check size={13}/>}</span><span>{it.label}</span>{it.key&&<kbd>{it.key}</kbd>}</button>);

 // ---------- Status (bottom-right): Sum, Average, Count of the selection ----------
 const stats=(()=>{if(box.c0===box.c1&&box.r0===box.r1)return null;const ns:number[]=[];let count=0;
  for(let r=box.r0;r<=Math.min(box.r1,used.mr);r++)for(let c=box.c0;c<=Math.min(box.c1,used.mc);c++){const v=values[ref(c,r)];if(v!==undefined&&v!==''){count++;if(typeof v==='number')ns.push(v);}}
  if(!count)return null;const sum=ns.reduce((a,b)=>a+b,0);return {sum,avg:ns.length?sum/ns.length:0,count,n:ns.length};})();

 // ---------- Grid rendering ----------
 const others=Object.values(peers).filter(p=>p.t===tab.id);
 const rowsToDraw=[...frozenVis,...(first<=last?vis.slice(first,last+1):[])];
 const cellStyle=(s:Style|undefined,c:number,r:number,num:boolean):React.CSSProperties=>({fontWeight:s?.b?700:undefined,fontStyle:s?.i?'italic':undefined,textDecoration:[s?.u?'underline':'',s?.s?'line-through':''].join(' ').trim()||undefined,
  color:s?.color,background:s?.bg,fontSize:s?.size?`${s.size}px`:undefined,textAlign:s?.h==='c'?'center':s?.h==='r'?'right':s?.h==='l'?'left':num&&s?.fmt!=='text'?'right':undefined,
  whiteSpace:s?.wrap?'normal':undefined,...(c<freeze.c?{position:'sticky',left:leftOf(c),zIndex:r<freeze.r?4:2}:{}),...(r<freeze.r?{position:'sticky',top:HEAD_H+vIndex[r]*ROW_H,zIndex:c<freeze.c?4:3}:{})});
 const totalW=leftOf(COLS);

 return <div className={`zn-page zs2${grid?'':' no-grid'}`} onContextMenu={e=>{if((e.target as HTMLElement).closest('.zs2-grid td'))e.preventDefault();}}>
  {sharing&&<ShareDoc docId={id} onClose={()=>setSharing(false)}/>}
  <input ref={imgIn} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void insertImage(f);e.target.value='';}}/>
  <input ref={csvIn} type="file" accept=".csv,text/csv" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importCsv(f);e.target.value='';}}/>

  <header className="zs2-top">
   <Link href={crumbs.at(-1)?.href??'/zarn/drive'} className="zs2-logo" aria-label="Back to Drive" data-tip="Back to Drive"><FileSpreadsheet size={26}/></Link>
   <div className="zs2-titles">
    <div className="zs2-titlerow"><input ref={titleIn} className="zs2-title" value={title} readOnly={!canEdit} maxLength={200} placeholder="Untitled sheet" aria-label="Title" onChange={e=>{setTitle(e.target.value);latest.current.title=e.target.value;queue();}} size={Math.max(6,(title||"Untitled sheet").length)}/>
     <span className="zs2-loc">     <span className="zs2-crumbs" title="Location in Drive"><Folder size={13}/>{crumbs.map((c,i)=><span key={c.href}>{i>0&&<ChevronRight size={12}/>}<Link href={c.href}>{c.name}</Link></span>)}</span>
     <span className={`zs2-state${state==='error'?' is-error':''}`}>{!canEdit?'View only':state==='saving'?<><Loader2 size={13} className="zn-spin"/>Saving…</>:state==='error'?<><CloudOff size={14}/>Not saved</>:<><CloudCheck size={14}/>Saved</>}</span></span></div>
    <nav className="zs2-menubar" onClick={e=>e.stopPropagation()}>{Object.keys(menus).map(m=><span key={m} className="zs2-mwrap"><button type="button" className={menu===m?'is-on':''} onClick={()=>setMenu(x=>x===m?null:m)} onMouseEnter={()=>{if(menu&&menu!==m)setMenu(m);}}>{m}</button>
     {menu===m&&<div className="zs2-menu" role="menu">{renderItems(menus[m])}</div>}</span>)}</nav>
   </div>
   <div className="zs2-right">
    {Object.values(peers).length>0&&<span className="zs2-peers">{Object.values(peers).slice(0,5).map(p=><span key={p.u} style={{boxShadow:`0 0 0 2px ${colorOf(p.u)}`}} title={people[p.u]?.display_name}><Avatar m={people[p.u]} size={28}/></span>)}</span>}
    {role==='owner'&&<button type="button" className="zs2-share" onClick={()=>setSharing(true)}><Share2 size={15}/>Share</button>}
   </div>
  </header>

  <div className={`zs2-toolbar${toolSheet?' is-sheet':''}`} onClick={e=>e.stopPropagation()}>
   <div className="zs2-sheet-head"><b>Format</b><button type="button" aria-label="Close" onClick={()=>{setToolSheet(false);setPop(null);}}><ChevronDown size={18}/></button></div>
   <button type="button" data-tip="Undo (⌘Z)" aria-label="Undo" disabled={!hl.u} onClick={undo}><Undo2 size={16}/></button>
   <button type="button" data-tip="Redo (⌘⇧Z)" aria-label="Redo" disabled={!hl.r} onClick={redo}><Redo2 size={16}/></button>
   <button type="button" data-tip="Print" aria-label="Print" onClick={print}><Printer size={16}/></button>
   <span className="zs2-sel"><select aria-label="Zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{zooms.map(z=><option key={z} value={z}>{Math.round(z*100)}%</option>)}</select></span>
   <i className="zs2-sep"/>
   <button type="button" data-tip="Format as currency" aria-label="Currency" disabled={!canEdit} className={st.fmt==='cur'?'is-on':''} onClick={()=>setFmt(st.fmt==='cur'?'auto':'cur','₦')}><b className="zs2-glyph">₦</b></button>
   <button type="button" data-tip="Format as percent" aria-label="Percent" disabled={!canEdit} className={st.fmt==='pct'?'is-on':''} onClick={()=>setFmt(st.fmt==='pct'?'auto':'pct')}><Percent size={15}/></button>
   <button type="button" data-tip="Decrease decimal places" aria-label="Fewer decimals" disabled={!canEdit} onClick={()=>bump(-1)}><b className="zs2-glyph">.0<small>←</small></b></button>
   <button type="button" data-tip="Increase decimal places" aria-label="More decimals" disabled={!canEdit} onClick={()=>bump(1)}><b className="zs2-glyph">.00<small>→</small></b></button>
   <span className="zs2-popwrap"><button type="button" data-tip="More formats" aria-label="More formats" disabled={!canEdit} onClick={()=>setPop(p=>p==='fmt'?null:'fmt')}><b className="zs2-glyph">123</b><ChevronDown size={12}/></button>
    {pop==='fmt'&&<div className="zs2-menu" ref={fitMenu}>{renderItems(fmtItems)}</div>}</span>
   <i className="zs2-sep"/>
   <span className="zs2-sel"><select aria-label="Font size" disabled={!canEdit} value={st.size??13} onChange={e=>{const v=Number(e.target.value);styleKeys(keysIn(box),s=>({...s,size:v===13?undefined:v}));}}>{fontSizes.map(f=><option key={f} value={f}>{f}</option>)}</select></span>
   <i className="zs2-sep"/>
   <button type="button" data-tip="Bold (⌘B)" aria-label="Bold" disabled={!canEdit} className={st.b?'is-on':''} onClick={()=>toggle('b')}><Bold size={16}/></button>
   <button type="button" data-tip="Italic (⌘I)" aria-label="Italic" disabled={!canEdit} className={st.i?'is-on':''} onClick={()=>toggle('i')}><Italic size={16}/></button>
   <button type="button" data-tip="Strikethrough" aria-label="Strikethrough" disabled={!canEdit} className={st.s?'is-on':''} onClick={()=>toggle('s')}><Strikethrough size={16}/></button>
   <button type="button" data-tip="Underline (⌘U)" aria-label="Underline" disabled={!canEdit} className={st.u?'is-on':''} onClick={()=>toggle('u')}><Underline size={16}/></button>
   <span className="zs2-popwrap"><button type="button" data-tip="Text colour" aria-label="Text colour" disabled={!canEdit} onClick={()=>setPop(p=>p==='color'?null:'color')}><span className="zs2-a" style={{borderColor:st.color??'currentColor'}}>A</span></button>
    {pop==='color'&&<div className="zs2-colors" ref={fitMenu}><button type="button" className="zs2-reset" onClick={()=>{setPop(null);styleKeys(keysIn(box),s=>({...s,color:undefined}));}}>Reset</button><div>{palette.map(c=><button key={c} type="button" aria-label={c} style={{background:c}} onClick={()=>{setPop(null);styleKeys(keysIn(box),s=>({...s,color:c}));}}/>)}</div></div>}</span>
   <span className="zs2-popwrap"><button type="button" data-tip="Fill colour" aria-label="Fill colour" disabled={!canEdit} onClick={()=>setPop(p=>p==='fill'?null:'fill')}><PaintBucket size={16}/><span className="zs2-bar" style={{background:st.bg??'transparent'}}/></button>
    {pop==='fill'&&<div className="zs2-colors" ref={fitMenu}><button type="button" className="zs2-reset" onClick={()=>{setPop(null);styleKeys(keysIn(box),s=>({...s,bg:undefined}));}}>Reset</button><div>{palette.map(c=><button key={c} type="button" aria-label={c} style={{background:c}} onClick={()=>{setPop(null);styleKeys(keysIn(box),s=>({...s,bg:c}));}}/>)}</div></div>}</span>
   <i className="zs2-sep"/>
   <button type="button" data-tip="Align left" aria-label="Align left" disabled={!canEdit} className={st.h==='l'?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,h:s.h==='l'?undefined:'l'}))}><AlignLeft size={16}/></button>
   <button type="button" data-tip="Align centre" aria-label="Align centre" disabled={!canEdit} className={st.h==='c'?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,h:s.h==='c'?undefined:'c'}))}><AlignCenter size={16}/></button>
   <button type="button" data-tip="Align right" aria-label="Align right" disabled={!canEdit} className={st.h==='r'?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,h:s.h==='r'?undefined:'r'}))}><AlignRight size={16}/></button>
   <button type="button" data-tip="Wrap text" aria-label="Wrap text" disabled={!canEdit} className={st.wrap?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,wrap:s.wrap?undefined:1}))}><WrapText size={16}/></button>
   <button type="button" data-tip="Clear formatting" aria-label="Clear formatting" disabled={!canEdit} onClick={()=>styleKeys(keysIn(box),()=>({}))}><Eraser size={16}/></button>
   <i className="zs2-sep"/>
   <span className="zs2-popwrap"><button type="button" data-tip="Borders" aria-label="Borders" disabled={!canEdit} onClick={()=>setPop(p=>p==='border'?null:'border')}><Grid2x2 size={16}/><ChevronDown size={12}/></button>
    {pop==='border'&&<div className="zs2-menu zs2-borders" ref={fitMenu} onClick={e=>e.stopPropagation()}>
     <div className="zs2-bgrid">{(['all','inner','horizontal','vertical','outer','left','top','right','bottom','clear'] as const).map(m=><button key={m} type="button" aria-label={`Borders: ${m}`} data-tip={m==='clear'?'Clear borders':`${m[0].toUpperCase()}${m.slice(1)} borders`} onClick={()=>{applyBorders(m);setPop(null);}}><BorderGlyph mode={m}/></button>)}</div>
     <hr/><p className="zs2-mhead">Line</p>
     <div className="zs2-blines">{([['1px solid','Thin'],['2px solid','Medium'],['3px solid','Thick'],['1px dashed','Dashed'],['1px dotted','Dotted'],['3px double','Double']] as const).map(([v,l])=><button key={v} type="button" className={bdLine===v?'is-on':''} aria-label={l} data-tip={l} onClick={()=>setBdLine(v)}><i style={{borderTop:`${v} currentColor`}}/></button>)}</div>
     <p className="zs2-mhead">Colour</p>
     <div className="zs2-bcolors"><button type="button" aria-label="Default (text colour)" data-tip="Default" className={bdColor==='currentColor'?'is-on':''} style={{background:'var(--z-fg)'}} onClick={()=>setBdColor('currentColor')}/>{palette.slice(0,23).map(c=><button key={c} type="button" aria-label={c} className={bdColor===c?'is-on':''} style={{background:c}} onClick={()=>setBdColor(c)}/>)}</div>
    </div>}</span>
   <span className="zs2-popwrap"><button type="button" data-tip="Merge cells" aria-label="Merge cells" disabled={!canEdit} onClick={()=>setPop(p=>p==='merge'?null:'merge')}><TableCellsMerge size={16}/><ChevronDown size={12}/></button>
    {pop==='merge'&&<div className="zs2-menu" ref={fitMenu}>{renderItems([{label:'Merge all',run:()=>void mergeCells('all')},{label:'Merge horizontally',run:()=>void mergeCells('h')},{label:'Merge vertically',run:()=>void mergeCells('v')},{label:'Unmerge',run:()=>void mergeCells('un')}])}</div>}</span>
   <button type="button" data-tip="Conditional formatting" aria-label="Conditional formatting" disabled={!canEdit} onClick={()=>setCfOpen(true)}><Highlighter size={16}/></button>
   <button type="button" data-tip="Insert link (⌘K)" aria-label="Insert link" disabled={!canEdit} onClick={openLinkEditor}><LinkIcon size={16}/></button>
   <button type="button" data-tip="Insert chart" aria-label="Insert chart" disabled={!canEdit} onClick={insertChart}><ChartColumnBig size={16}/></button>
   <span className="zs2-popwrap"><button type="button" data-tip="Insert image" aria-label="Insert image" disabled={!canEdit||imgBusy} onClick={()=>setPop(p=>p==='img'?null:'img')}>{imgBusy?<Loader2 size={16} className="zn-spin"/>:<ImagePlus size={16}/>}<ChevronDown size={12}/></button>
    {pop==='img'&&<div className="zs2-menu" ref={fitMenu}>{renderItems([{label:'Image in cell',run:()=>pickImage('cell')},{label:'Image over cells',run:()=>pickImage('over')}])}</div>}</span>
   <button type="button" data-tip="Add comment (⌘⌥M)" aria-label="Add comment" onClick={()=>setCmtOpen(k)}><MessageSquarePlus size={16}/></button>
   <button type="button" data-tip="Insert date" aria-label="Insert date" disabled={!canEdit} onClick={()=>{styleKeys(keysIn(box),s2=>({...s2,fmt:'date'}));startEdit(tab.cells[k]??'','edit');}}><CalendarDays size={16}/></button>
   <i className="zs2-sep"/>
   <button type="button" data-tip={filt?'Remove filter':'Create a filter'} aria-label={filt?'Remove filter':'Create a filter'} disabled={!canEdit} className={filt?'is-on':''} onClick={()=>filt?removeFilter():createFilter()}><Filter size={16}/></button>
   <button type="button" data-tip="Insert checkbox" aria-label="Insert checkbox" disabled={!canEdit} onClick={addCheckbox}><SquareCheckBig size={16}/></button>
   <button type="button" data-tip="Insert dropdown" aria-label="Insert dropdown" disabled={!canEdit} onClick={openDropdown}><SquareChevronDown size={16}/></button>
   <i className="zs2-sep"/>
   <span className="zs2-popwrap"><button type="button" data-tip="Functions" aria-label="Functions" disabled={!canEdit} onClick={()=>setPop(p=>p==='fx'?null:'fx')}><Sigma size={16}/><ChevronDown size={12}/></button>
    {pop==='fx'&&<div className="zs2-menu" ref={fitMenu}>{['SUM','AVERAGE','COUNT','MAX','MIN'].map(n=><button key={n} type="button" onClick={()=>{setPop(null);if(box.r1>box.r0||box.c1>box.c0){const target=box.r1+1<ROWS?ref(box.c0,box.r1+1):ref(box.c1+1,box.r0);setCells([{tab:tab.id,k:target,v:`=${n}(${ref(box.c0,box.r0)}:${ref(box.c1,box.r1)})`}]);}else startEdit(`=${n}(`,'edit');}}><span className="zs2-mcheck"/><span>{n}</span></button>)}<hr/><button type="button" onClick={()=>{setPop(null);setHelp('fx');}}><span className="zs2-mcheck"/><span>All functions…</span></button></div>}</span>
  </div>

  {canEdit&&<div className="zs2-mbar" onClick={e=>e.stopPropagation()}>
   <button type="button" aria-label="Undo" disabled={!hl.u} onClick={undo}><Undo2 size={19}/></button>
   <button type="button" aria-label="Redo" disabled={!hl.r} onClick={redo}><Redo2 size={19}/></button><i/>
   <button type="button" aria-label="Bold" className={st.b?'is-on':''} onClick={()=>toggle('b')}><Bold size={19}/></button>
   <button type="button" aria-label="Italic" className={st.i?'is-on':''} onClick={()=>toggle('i')}><Italic size={19}/></button>
   <button type="button" aria-label="Align centre" className={st.h==='c'?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,h:s.h==='c'?undefined:'c'}))}><AlignCenter size={19}/></button>
   <button type="button" aria-label="Wrap text" className={st.wrap?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,wrap:s.wrap?undefined:1}))}><WrapText size={19}/></button>
   <button type="button" className={`zs2-aa${toolSheet?' is-open':''}`} aria-label="All formatting tools" aria-expanded={toolSheet} onClick={()=>{setPop(null);setToolSheet(v=>!v);}}><b>Aa</b>{toolSheet?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button>
  </div>}
  <div className="zs2-fbar">
   <input className="zs2-name" aria-label="Name box" defaultValue={box.c0===box.c1&&box.r0===box.r1?k:`${ref(box.c0,box.r0)}:${ref(box.c1,box.r1)}`} key={`${k}-${box.c0}-${box.r0}-${box.c1}-${box.r1}`}
    onKeyDown={e=>{if(e.key!=='Enter')return;const v=e.currentTarget.value.toUpperCase().trim();const [a,b]=v.split(':');const p=parseRef(a),q=b?parseRef(b):null;if(p){if(q){setAnchor(p);setSel(q);}else{setAnchor(null);setSel(p);}gridRef.current?.focus();}}}/>
   <span className="zs2-fx">fx</span>
   <input ref={barIn} className="zs2-formula" value={editing??(st.fmt==='date'&&/^\d+$/.test(tab.cells[k]??'')?show(Number(tab.cells[k]),{fmt:'date'}):tab.cells[k]??'')} readOnly={!canEdit} aria-label="Cell contents"
    onFocus={()=>{if(editing===null&&canEdit)startEdit(tab.cells[k]??'','edit','bar');else setEditIn('bar');}} onChange={e=>setEditing(e.target.value)} onKeyDown={onEditKey}/>
  </div>

  <div ref={gridRef} className="zs2-grid" tabIndex={0} onKeyDown={onKey} onCopy={e=>onCopy(e)} onCut={e=>onCopy(e,true)} onPaste={onPaste} onScroll={onScroll} data-lenis-prevent>
   <table style={{width:totalW,zoom}}>
    <colgroup><col style={{width:ROWHEAD_W}}/>{Array.from({length:COLS},(_,c)=>hCols.has(c)?null:<col key={c} style={{width:width(c)}}/>)}</colgroup>
    <thead><tr>
     <th className="zs2-corner" onMouseDown={()=>{setAnchor([COLS-1,ROWS-1]);setSel([0,0]);}}/>
     {Array.from({length:COLS},(_,c)=>hCols.has(c)?null:<th key={c} className={`${c>=box.c0&&c<=box.c1?'is-hl':''}${box.r0===0&&box.r1===ROWS-1&&c>=box.c0&&c<=box.c1?' is-full':''}`} style={c<freeze.c?{left:leftOf(c),zIndex:6}:undefined}
      onMouseDown={e=>{if((e.target as HTMLElement).classList.contains('zs2-resize'))return;if(editing!==null)commitEdit();if(e.shiftKey&&anchor){setAnchor([anchor[0],ROWS-1]);setSel([c,0]);}else{setAnchor([c,ROWS-1]);setSel([c,0]);}drag.current={kind:null};gridRef.current?.focus();}}
      onContextMenu={e=>{e.preventDefault();if(!(c>=box.c0&&c<=box.c1&&box.r0===0&&box.r1===ROWS-1)){setAnchor([c,ROWS-1]);setSel([c,0]);}setCtx({x:e.clientX,y:e.clientY});}}>
      {colName(c)}{canEdit&&<span className="zs2-resize" onMouseDown={e=>{e.stopPropagation();drag.current={kind:'resize',col:c,x:e.clientX,w:width(c)};}} onDoubleClick={()=>setTab(tab.id,t=>{const w={...(t.widths??{})};delete w[c];return {...t,widths:w};})}/>}
      {c===freeze.c-1&&<span className="zs2-freeze-v"/>}
      {c>0&&hCols.has(c-1)&&<button type="button" className="zs2-unhide is-left" aria-label="Show hidden columns" data-tip="Show hidden columns" onMouseDown={e=>{e.stopPropagation();e.preventDefault();unhide('c',runOf(hCols,c-1,-1),c-1);}}/>}{hCols.has(c+1)&&<button type="button" className="zs2-unhide is-right" aria-label="Show hidden columns" onMouseDown={e=>{e.stopPropagation();e.preventDefault();unhide('c',c+1,runOf(hCols,c+1,1));}}/>}</th>)}
    </tr></thead>
    <tbody>
     {rowsToDraw.map((r,i)=><FragmentRow key={r} gapBefore={i===nF&&first>nF?(first-nF)*ROW_H:0}>
      <tr style={{height:ROW_H}}>
       <th className={`zs2-rh${r>=box.r0&&r<=box.r1?' is-hl':''}${box.c0===0&&box.c1===COLS-1&&r>=box.r0&&r<=box.r1?' is-full':''}${r===freeze.r-1?' is-freeze':''}`} style={r<freeze.r?{top:HEAD_H+vIndex[r]*ROW_H,zIndex:5}:undefined}
        onMouseDown={e=>{if(editing!==null)commitEdit();if(e.shiftKey&&anchor){setAnchor([COLS-1,anchor[1]]);setSel([0,r]);}else{setAnchor([COLS-1,r]);setSel([0,r]);}gridRef.current?.focus();}}
        onContextMenu={e=>{e.preventDefault();if(!(r>=box.r0&&r<=box.r1&&box.c0===0&&box.c1===COLS-1)){setAnchor([COLS-1,r]);setSel([0,r]);}setCtx({x:e.clientX,y:e.clientY});}}>{r+1}{r>0&&manualRows.has(r-1)&&<button type="button" className="zs2-unhide is-up" aria-label="Show hidden rows" data-tip="Show hidden rows" onMouseDown={e=>{e.stopPropagation();e.preventDefault();unhide('r',runOf(manualRows,r-1,-1),r-1);}}/>}{manualRows.has(r+1)&&<button type="button" className="zs2-unhide is-down" aria-label="Show hidden rows" onMouseDown={e=>{e.stopPropagation();e.preventDefault();unhide('r',r+1,runOf(manualRows,r+1,1));}}/>}</th>
       {Array.from({length:COLS},(_,c)=>{if(hCols.has(c))return null;const mg=mergeAt(c,r);const x=ref(c,r),s=tab.style?.[x],v=values[x],rule=ruleOf(c,r),cur=c===sel[0]&&r===sel[1],inside=c>=box.c0&&c<=box.c1&&r>=box.r0&&r<=box.r1,peer=others.find(p=>p.s===x);
        const fillTarget=fill&&(()=>{const down=Math.abs(fill[1]-box.r1)>=Math.abs(fill[0]-box.c1);return down?(c>=box.c0&&c<=box.c1&&((fill[1]>box.r1&&r>box.r1&&r<=fill[1])||(fill[1]<box.r0&&r<box.r0&&r>=fill[1]))):(r>=box.r0&&r<=box.r1&&((fill[0]>box.c1&&c>box.c1&&c<=fill[0])||(fill[0]<box.c0&&c<box.c0&&c>=fill[0])));})();
        const edges=inside?`${r===box.r0?' t':''}${r===box.r1?' b':''}${c===box.c0?' l':''}${c===box.c1?' r':''}`:'';
        return <td key={c} className={`${notes[x]?' has-note':''}${comments[x]&&!comments[x].done?' has-cmt':''}${mg?(mg.c0===c&&mg.r0===r?' is-manchor':' is-mcov'):''}${filt&&r===filt.b.r0&&c>=filt.b.c0&&c<=filt.b.c1?' is-fhead':''}${showProt&&protAt(tab.prot,c,r)?' is-prot':''}${rule?` is-${rule.t}`:''}${inside&&!cur?' is-in':''}${edges?` is-edge${edges}`:''}${cur?' is-cur':''}${isError(v)?' is-err':''}${fillTarget?' is-fill':''}${c===freeze.c-1?' is-fz-c':''}${r===freeze.r-1?' is-fz-r':''}`} style={{...cellStyle(s,c,r,typeof v==='number'),...cfFor(c,r,x,v)}}
         onMouseDown={e=>cellDown(e,c,r)} onMouseEnter={()=>cellEnter(c,r)} onDoubleClick={()=>{const rl=ruleOf(c,r);if(rl?.t==='check')return;if(rl?.t==='list'&&canEdit){setDd(x);return;}startEdit(tab.cells[x]??'','edit');}} onContextMenu={e=>{e.preventDefault();setCtx({x:e.clientX,y:e.clientY});}}>
         {notes[x]&&<span className="zs2-tri is-note"/>}{comments[x]&&!comments[x].done&&<span className="zs2-tri is-cmt"/>}
         {notes[x]&&!(cur&&noteEdit===x)&&<span className="zs2-notebub">{notes[x]}</span>}
         {cur&&noteEdit===x&&<NoteEdit init={notes[x]??''} onDone={t=>saveNote(x,t)}/>}
         {cur&&editing===null&&noteEdit!==x&&(cmtOpen===x||(comments[x]&&!comments[x].done))&&<CommentPop c={comments[x]&&!comments[x].done?comments[x]:undefined} me={me.user_id} people={people} canEdit={canEdit} onAdd={t=>addComment(x,t)} onResolve={()=>{putCmt(x,cc=>cc&&{...cc,done:1});setCmtOpen(null);}} onDelete={()=>{putCmt(x,()=>undefined);setCmtOpen(null);}} onClose={()=>setCmtOpen(null)}/>}
         {s?.bd&&<span className="zs2-bd" style={{borderTop:s.bd.t,borderRight:s.bd.r,borderBottom:s.bd.b,borderLeft:s.bd.l}}/>}
         {mg&&(mg.c0!==c||mg.r0!==r)?null:wrapMerge(mg,cur,{...cellStyle(s,c,r,typeof v==='number'),...cfFor(c,r,x,v)},<>{cur&&editing!==null&&editIn==='cell'?<input ref={cellIn} className="zs2-in" value={editing} onChange={e=>setEditing(e.target.value)} onKeyDown={onEditKey} onBlur={e=>{if(!drag.current.kind&&!(e.relatedTarget as HTMLElement|null)?.closest('.zs2-fbar,.zs2-suggest'))commitEdit();}}/>
          :/^=IMAGE\(/i.test(tab.cells[x]??'')&&typeof v==='string'&&v?<img className="zs2-cimg" src={v} alt="" draggable={false}/* eslint-disable-line @next/next/no-img-element */ />
          :rule?.t==='check'?<span className={`zs2-check${isTrue(tab.cells[x])||v===true?' is-on':''}`} role="checkbox" aria-checked={isTrue(tab.cells[x])} onMouseDown={e=>{if(e.button!==0||!canEdit)return;e.stopPropagation();e.preventDefault();if(editing!==null)commitEdit();setAnchor(null);setSel([c,r]);toggleChecks([x]);gridRef.current?.focus();}}/>
          :rule?.t==='list'?<>{(()=>{const txt=show(v,s);if(!txt)return null;const o=rule.opts?.find(y=>y.v.toLowerCase()===txt.toLowerCase());return o?<span className="zs2-chip" style={{background:o.c??CHIP_COLORS[0],color:chipInk(o.c??CHIP_COLORS[0])}}>{txt}</span>:<span className="zs2-badval" title="Not one of the dropdown options">{txt}</span>;})()}
           <button type="button" tabIndex={-1} className="zs2-dd" aria-label="Open dropdown" onMouseDown={e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();if(editing!==null)commitEdit();setAnchor(null);setSel([c,r]);if(canEdit)setDd(d=>d===x?null:x);}} onClick={e=>e.stopPropagation()}><ChevronDown size={13}/></button>
           {dd===x&&cur&&<div className="zs2-ddpop" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
            <div className="zs2-ddlist">{(rule.opts??[]).map(o=><button key={o.v} type="button" className={show(v,s).toLowerCase()===o.v.toLowerCase()?'is-on':''} onClick={()=>pickOpt(x,o.v)}><span className="zs2-chip" style={{background:o.c??CHIP_COLORS[0],color:chipInk(o.c??CHIP_COLORS[0])}}>{o.v}</span>{show(v,s).toLowerCase()===o.v.toLowerCase()&&<Check size={14}/>}</button>)}</div>
            <div className="zs2-ddfoot">{tab.cells[x]&&<button type="button" onClick={()=>pickOpt(x,'')}><X size={13}/>Clear</button>}<button type="button" onClick={()=>{setDd(null);setRuleEdit(rule);}}><Pencil size={13}/>Edit</button></div>
           </div>}</>
          :(()=>{const t=show(v,s);const u=t&&linkOf(tab.cells[x],t);return u?<span className="zs2-link">{t}</span>:t;})()}</>)}
         {cur&&editing===null&&!dd&&(()=>{const u=linkOf(tab.cells[x],show(v,s));if(!u)return null;let label=u;try{const q=new URL(u);label=q.host+(q.pathname.length>1?q.pathname:'');}catch{}
          return <div className="zs2-linkcard" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}><a href={u} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/><span>{label}</span></a>{canEdit&&<><button type="button" aria-label="Edit link" data-tip="Edit link" onClick={openLinkEditor}><Pencil size={14}/></button>{/^=HYPERLINK\(/i.test(tab.cells[x]??'')&&<button type="button" aria-label="Remove link" data-tip="Remove link" onClick={()=>setCells([{tab:tab.id,k:x,v:show(v,s)}])}><Unlink size={14}/></button>}</>}</div>;})()}
         {filt&&r===filt.b.r0&&c>=filt.b.c0&&c<=filt.b.c1&&<button type="button" tabIndex={-1} className={`zs2-fbtn${filt.hide[c]?.length?' is-on':''}`} aria-label="Filter this column" onMouseDown={e=>{e.stopPropagation();e.preventDefault();}} onClick={e=>{e.stopPropagation();const rc=e.currentTarget.getBoundingClientRect();setFpop(p=>p?.c===c?null:{c,x:rc.right,y:rc.bottom});}}>{filt.hide[c]?.length?<Filter size={12}/>:<ListFilter size={13}/>}</button>}
         {cur&&canEdit&&editing===null&&box.c0===box.c1&&box.r0===box.r1&&<span className="zs2-handle" onMouseDown={e=>{e.stopPropagation();e.preventDefault();drag.current={kind:'fill'};}}/>}
         {!cur&&c===box.c1&&r===box.r1&&canEdit&&editing===null&&(box.c0!==box.c1||box.r0!==box.r1)&&<span className="zs2-handle" onMouseDown={e=>{e.stopPropagation();e.preventDefault();drag.current={kind:'fill'};}}/>}
         {peer&&<span className="zs2-peer" style={{borderColor:colorOf(peer.u)}}><em style={{background:colorOf(peer.u)}}>{people[peer.u]?.display_name?.split(' ')[0]??'Someone'}</em></span>}
         {cur&&editing!==null&&editIn==='cell'&&s?.fmt==='date'&&!editing.startsWith('=')&&<DatePick text={editing} onPick={n=>{commitEdit(String(n));}}/>}
         {cur&&editing!==null&&editIn==='cell'&&(fx.list.length>0||fx.help)&&<div className="zs2-suggest" onMouseDown={e=>e.preventDefault()}>
          {fx.list.map((n,j)=><button key={n} type="button" className={j===pick?'is-on':''} onClick={()=>acceptFx(n)}><b>{n}</b><small>{FUNCTIONS[n].help}</small></button>)}
          {!fx.list.length&&fx.help&&<p>{fx.help}</p>}</div>}
        </td>;})}
      </tr></FragmentRow>)}
     <tr style={{height:Math.max(0,(vis.length-1-last)*ROW_H)}}><td colSpan={COLS+1} className="zs2-spacer"/></tr>
    </tbody>
   </table>
   <div className="zs2-objs" style={{zoom}}>{objs.map(o=>{const d=objDraft?.id===o.id?{...o,...objDraft}:o;const on=objSel===o.id;
    return <div key={o.id} className={`zs2-obj is-${o.kind}${on?' is-on':''}`} style={{left:d.x,top:d.y,width:d.w,height:d.h}}
     onMouseDown={e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();if(editing!==null)commitEdit();setObjSel(o.id);gridRef.current?.focus();if(canEdit)objDrag.current={id:o.id,mode:'move',sx:e.clientX,sy:e.clientY,o:{x:o.x,y:o.y,w:o.w,h:o.h}};}}
     onDoubleClick={()=>{if(o.kind==='chart'&&canEdit)setChartEdit(o.id);}}>
     {o.kind==='image'?<img src={o.src} alt="" draggable={false}/* eslint-disable-line @next/next/no-img-element */ />:<ChartView o={o} values={values} tab={tab} w={d.w} h={d.h}/>}
     {on&&canEdit&&<><span className="zs2-obj-size" onMouseDown={e=>{e.stopPropagation();e.preventDefault();objDrag.current={id:o.id,mode:'size',sx:e.clientX,sy:e.clientY,o:{x:o.x,y:o.y,w:o.w,h:o.h}};}}/>
      <span className="zs2-obj-tools" onMouseDown={e=>e.stopPropagation()}>{o.kind==='chart'&&<button type="button" onClick={()=>setChartEdit(o.id)}><Pencil size={13}/>Edit chart</button>}<button type="button" aria-label="Delete" onClick={()=>{putObj(o.id,()=>null);setObjSel(null);}}><Trash2 size={13}/>Delete</button></span></>}
    </div>;})}</div>
  </div>

  <footer className="zs2-foot" onClick={e=>e.stopPropagation()}>
   {canEdit&&<button type="button" className="zs2-ticon" aria-label="Add tab" data-tip="Add tab" onClick={addTab}><Plus size={16}/></button>}
   <span className="zs2-popwrap"><button type="button" className="zs2-ticon" aria-label="All tabs" data-tip="All tabs" onClick={()=>setPop(p=>p==='tabs'?null:'tabs')}><Menu size={16}/></button>
    {pop==='tabs'&&<div className="zs2-menu is-up">{tabs.map(t=><button key={t.id} type="button" onClick={()=>{setPop(null);setTabId(t.id);setSel([0,0]);setAnchor(null);}}><span className="zs2-mcheck">{t.id===tab.id&&<Check size={13}/>}</span><span>{t.name}</span></button>)}</div>}</span>
   <div className="zs2-tabs">{tabs.map(t=><span key={t.id} className={`zs2-tab${t.id===tab.id?' is-on':''}`} style={t.color?{boxShadow:`inset 0 -3px 0 ${t.color}`}:undefined}>
    {renamingTab===t.id?<input autoFocus defaultValue={t.name} maxLength={40} aria-label="Tab name" onBlur={e=>renameTab(t,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')renameTab(t,e.currentTarget.value);else if(e.key==='Escape')setRenamingTab(null);}}/>
     :<button type="button" onClick={()=>{if(t.id!==tab.id){setTabId(t.id);setSel([0,0]);setAnchor(null);}}} onDoubleClick={()=>{if(canEdit)setRenamingTab(t.id);}} onContextMenu={e=>{e.preventDefault();if(canEdit)setTabMenu(t.id);}}>{t.name}</button>}
    {canEdit&&t.id===tab.id&&renamingTab!==t.id&&<button type="button" className="zs2-tcaret" aria-label={`${t.name} options`} onClick={()=>setTabMenu(m=>m===t.id?null:t.id)}><ChevronDown size={13}/></button>}
    {tabMenu===t.id&&<div className="zs2-menu is-up">
     <button type="button" onClick={()=>{setTabMenu(null);setRenamingTab(t.id);}}><span className="zs2-mcheck"/><span>Rename</span></button>
     <button type="button" onClick={()=>{setTabMenu(null);dupTab(t);}}><span className="zs2-mcheck"/><span>Duplicate</span></button>
     <button type="button" disabled={data.tabs.length<2} onClick={()=>{setTabMenu(null);void dropTab(t);}}><span className="zs2-mcheck"/><span>Delete</span></button>
     <hr/><p className="zs2-mhead">Tab colour</p><div className="zs2-tabcolors">{[undefined,'#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899'].map(c=><button key={c??'none'} type="button" aria-label={c??'No colour'} style={{background:c??'var(--z-border)'}} onClick={()=>{setTabMenu(null);setTab(t.id,x=>({...x,color:c}));}}/>)}</div>
    </div>}</span>)}</div>
   {stats&&<span className="zs2-stats">{stats.n>0?<>Sum: <b>{show(stats.sum,st)}</b><i/>Average: <b>{show(Math.round(stats.avg*1e6)/1e6,st)}</b><i/></>:null}Count: <b>{stats.count}</b></span>}
  </footer>

  {ctx&&<div className="zs2-menu zs2-ctx" style={{left:Math.min(ctx.x,window.innerWidth-260),top:Math.min(ctx.y,window.innerHeight-420)}} onClick={e=>e.stopPropagation()}>
   {renderItems([{label:'Cut',key:'⌘X',run:()=>void menuCopy(true),off:!canEdit},{label:'Copy',key:'⌘C',run:()=>void menuCopy(false)},{label:'Paste',key:'⌘V',run:()=>void menuPaste(),off:!canEdit},'-',
    {label:`Insert ${box.r1-box.r0+1>1?`${box.r1-box.r0+1} rows`:'1 row'} above`,run:()=>shift('r',box.r0,box.r1-box.r0+1),off:!canEdit},{label:'Insert 1 row below',run:()=>shift('r',box.r1+1,1),off:!canEdit},
    {label:`Insert ${box.c1-box.c0+1>1?`${box.c1-box.c0+1} columns`:'1 column'} left`,run:()=>shift('c',box.c0,box.c1-box.c0+1),off:!canEdit},{label:'Insert 1 column right',run:()=>shift('c',box.c1+1,1),off:!canEdit},'-',
    {label:box.r0===box.r1?`Delete row ${box.r0+1}`:`Delete rows ${box.r0+1} – ${box.r1+1}`,run:()=>shift('r',box.r0,-(box.r1-box.r0+1)),off:!canEdit},{label:box.c0===box.c1?`Delete column ${colName(box.c0)}`:`Delete columns ${colName(box.c0)} – ${colName(box.c1)}`,run:()=>shift('c',box.c0,-(box.c1-box.c0+1)),off:!canEdit},
    ...(box.r0===0&&box.r1===ROWS-1?[]:[{label:box.r0===box.r1?`Hide row ${box.r0+1}`:`Hide rows ${box.r0+1} – ${box.r1+1}`,run:hideRows,off:!canEdit} as Item]),...(box.c0===0&&box.c1===COLS-1?[]:[{label:box.c0===box.c1?`Hide column ${colName(box.c0)}`:`Hide columns ${colName(box.c0)} – ${colName(box.c1)}`,run:hideCols,off:!canEdit} as Item]),'-',
    {label:'Clear contents',run:()=>setCells(keysIn(box).filter(x=>tab.cells[x]).map(x=>({tab:tab.id,k:x,v:''}))),off:!canEdit},'-',
    {label:'Dropdown',run:openDropdown,off:!canEdit},{label:'Checkbox',run:addCheckbox,off:!canEdit},'-',
    {label:'Comment',key:'⌘⌥M',run:()=>setCmtOpen(k)},{label:notes[k]?'Edit note':'Insert note',key:'⇧F2',run:()=>setNoteEdit(k),off:!canEdit},...(notes[k]?[{label:'Clear note',run:()=>saveNote(k,''),off:!canEdit} as Item]:[]),'-',
    {label:'Sort range A → Z',run:()=>sort(1,false),off:!canEdit},{label:'Sort range Z → A',run:()=>sort(-1,false),off:!canEdit}])}
  </div>}

  {find&&<div className="zs2-find" onClick={e=>e.stopPropagation()}>
   <Search size={15}/><input autoFocus placeholder="Find in sheet" value={find.q} onChange={e=>setFind({...find,q:e.target.value,at:-1})} onKeyDown={e=>{if(e.key==='Enter')findNext();if(e.key==='Escape'){setFind(null);gridRef.current?.focus();}}}/>
   <small>{find.q?matches.length?`${find.at+1>0?find.at+1:0} of ${matches.length}`:'No results':''}</small>
   <button type="button" onClick={findNext} disabled={!matches.length}>Next</button>
   {canEdit&&<><input placeholder="Replace with" value={find.rep} onChange={e=>setFind({...find,rep:e.target.value})}/><button type="button" onClick={replaceAll} disabled={!find.q}>Replace all</button></>}
   <button type="button" aria-label="Close" onClick={()=>{setFind(null);gridRef.current?.focus();}}><X size={15}/></button>
  </div>}

  {ruleEdit&&<RuleEditor rule={ruleEdit} exists={(tab.valid??[]).some(x=>x.id===ruleEdit.id)} onClose={()=>setRuleEdit(null)} onSave={x=>{saveRule(x);setRuleEdit(null);gridRef.current?.focus();}} onRemove={()=>{dropRule(ruleEdit.id);setRuleEdit(null);}}/>}
  {fpop&&filt&&(()=>{const vals=new Map<string,number>();for(let r=filt.b.r0+1;r<=Math.min(filt.b.r1,used.mr);r++){const x=ref(fpop.c,r),t2=show(values[x],tab.style?.[x]);vals.set(t2,(vals.get(t2)??0)+1);}
   return <FilterPop key={fpop.c} x={fpop.x} y={fpop.y} col={tab.cells[ref(fpop.c,filt.b.r0)]||`Column ${colName(fpop.c)}`} values={[...vals.entries()].sort((a,b)=>a[0]===''?1:b[0]===''?-1:a[0].localeCompare(b[0],undefined,{numeric:true}))} hidden={filt.hide[fpop.c]??[]} canEdit={canEdit}
    onSort={d=>{setFpop(null);sortRange({...filt.b,r0:filt.b.r0+1,r1:Math.min(filt.b.r1,Math.max(used.mr,filt.b.r0+1))},fpop.c,d);}} onApply={h=>{setFpop(null);setFilterHide(fpop.c,h);}} onClose={()=>setFpop(null)}/>;})()}
  {chartEdit&&(()=>{const o=objs.find(y=>y.id===chartEdit);return o?<ChartEditor o={o} values={values} tab={tab} onClose={()=>setChartEdit(null)} onSave={n=>{putObj(o.id,()=>n);setChartEdit(null);}}/>:null;})()}
  {cmtPanel&&<Modal title="Comments" onClose={()=>setCmtPanel(false)}><div className="zn-modal-body"><ul className="zs2-cmtlist">{openCmts.length?openCmts.map(([x,c])=><li key={x}><button type="button" onClick={()=>{const pp=parseRef(x);if(pp){setAnchor(null);setSel(pp);}setCmtPanel(false);}}><b>{x}</b><span>{people[c.u]?.display_name??'Someone'}: {c.t}</span><small>{(c.re?.length??0)>0?`${c.re!.length} repl${c.re!.length===1?'y':'ies'}`:''}</small></button></li>):<li className="zn-nav-note">No open comments on this tab.</li>}</ul></div></Modal>}
  {cfOpen&&<CfPanel rules={tab.cf??[]} range={rangeOf(box)} onClose={()=>setCfOpen(false)} onChange={cf=>setTab(tab.id,t=>({...t,cf}))}/>}
  {linkEdit&&<LinkModal init={linkEdit} onClose={()=>{setLinkEdit(null);gridRef.current?.focus();}} onSave={saveLink}/>}
  {verOpen&&<VersionPanel db={db} docId={id} people={people} canEdit={role==='owner'||role==='edit'} isOwner={role==='owner'} previewId={preview?.id??null} onPreview={setPreview} onRestore={(d,l)=>void restoreVersion(d,l)} onClose={()=>{setVerOpen(false);setPreview(null);}}/>}
  {preview&&<div className="zs2-verbar" role="status"><b>Earlier version</b><span>{preview.label}</span><button type="button" className="zn-btn" onClick={()=>setPreview(null)}>Back to current</button></div>}
  {protOpen&&<ProtectPanel prot={tab.prot??[]} range={rangeOf(box)} me={me.user_id} isOwner={role==='owner'} members={members.filter(m=>!m.deactivated_at)} onChange={pr=>setTab(tab.id,t=>({...t,prot:pr}))} onClose={()=>setProtOpen(false)}/>}
  {tab.pivot&&canEdit&&!verOpen&&(pivOpen?<PivotEditor key={tab.id} p={tab.pivot} head={pivots[tab.id]?.head??[]} tabs={tabs} onChange={pv=>setTab(tab.id,t=>({...t,pivot:pv}))} onClose={()=>setPivOpen(false)}/>
   :<button type="button" className="zs2-pivbtn zn-btn" onClick={()=>setPivOpen(true)}>Edit pivot table</button>)}
  {warn&&<div className="zs2-warn" role="alert">{warn}</div>}
  {help==='keys'&&<Modal title="Keyboard shortcuts" onClose={()=>setHelp(null)} wide><div className="zn-modal-body"><dl className="zs2-keys">{([['Arrow keys','Move'],['Shift + arrows','Select a range'],['⌘ + arrows','Jump to the edge of the data'],['Enter / F2','Edit the cell'],['Type','Replace the cell'],['Tab / Shift+Tab','Move right / left'],['Delete','Clear the selection'],['⌘C / ⌘X / ⌘V','Copy / cut / paste'],['⌘Z / ⌘⇧Z','Undo / redo'],['⌘D / ⌘R','Fill down / right'],['⌘B / ⌘I / ⌘U','Bold / italic / underline'],['⌘A','Select all'],['⌘F','Find and replace'],['Drag the blue square','Fill or continue formulas'],['Click cells while typing =','Insert references']] as const).map(([a,b])=><div key={a}><dt><kbd>{a}</kbd></dt><dd>{b}</dd></div>)}</dl></div></Modal>}
  {help==='fx'&&<Modal title="Functions" onClose={()=>setHelp(null)} wide><div className="zn-modal-body"><ul className="zs2-fxlist">{FUNCTION_NAMES.map(n=><li key={n}><b>{n}</b><code>{FUNCTIONS[n].help}</code></li>)}</ul></div></Modal>}
 </div>;
}

// A row with an optional spacer before it (for the rows scrolled out of view between the frozen rows and the visible ones).
function FragmentRow({gapBefore,children}:{gapBefore:number;children:React.ReactNode}){
 return <>{gapBefore>0&&<tr style={{height:gapBefore}}><td colSpan={COLS+1} className="zs2-spacer"/></tr>}{children}</>;
}

// Data validation panel: a dropdown's options (each with a chip colour) or a checkbox, and the cells it applies to.
function RuleEditor({rule,exists,onClose,onSave,onRemove}:{rule:Rule;exists:boolean;onClose:()=>void;onSave:(r:Rule)=>void;onRemove:()=>void}){
 const [t,setT]=useState<Rule['t']>(rule.t),[range,setRange]=useState(rule.range),[strict,setStrict]=useState(!!rule.strict);
 const [opts,setOpts]=useState<{v:string;c?:string;key:string}[]>(()=>(rule.opts?.length?rule.opts:[{v:'',c:CHIP_COLORS[0]}]).map((o,i)=>({...o,key:`${i}-${o.v}`})));
 const [colorAt,setColorAt]=useState<string|null>(null),[err,setErr]=useState('');
 function save(e:React.FormEvent){e.preventDefault();const b=parseRange(range);if(!b){setErr('Enter a range like B2:B100.');return;}
  const clean=opts.map(o=>({v:o.v.trim(),c:o.c})).filter(o=>o.v).filter((o,i,a)=>a.findIndex(y=>y.v.toLowerCase()===o.v.toLowerCase())===i);
  if(t==='list'&&!clean.length){setErr('Add at least one option.');return;}
  const r2=b.c0===b.c1&&b.r0===b.r1?ref(b.c0,b.r0):`${ref(b.c0,b.r0)}:${ref(b.c1,b.r1)}`;
  onSave(t==='list'?{id:rule.id,range:r2,t,opts:clean,...(strict?{strict:1 as const}:{})}:{id:rule.id,range:r2,t});}
 return <Modal title="Data validation" onClose={onClose}><form className="zn-modal-body zs2-rule" onSubmit={save}>
  <label className="zn-label">Apply to range<input className="zn-input" value={range} onChange={e=>setRange(e.target.value)} spellCheck={false} autoCapitalize="characters"/></label>
  <div className="zs2-rule-type" role="radiogroup" aria-label="Type">{([['list','Dropdown'],['check','Checkbox']] as const).map(([v,l])=><button key={v} type="button" role="radio" aria-checked={t===v} className={t===v?'is-on':''} onClick={()=>setT(v)}>{v==='list'?<SquareChevronDown size={15}/>:<SquareCheckBig size={15}/>}{l}</button>)}</div>
  {t==='list'?<>
   <div className="zn-label">Options</div>
   <ul className="zs2-rule-opts">{opts.map((o,i)=><li key={o.key}>
    <span className="zs2-rule-sw"><button type="button" aria-label="Chip colour" style={{background:o.c??CHIP_COLORS[0]}} onClick={()=>setColorAt(c=>c===o.key?null:o.key)}/>
     {colorAt===o.key&&<span className="zs2-rule-pal">{CHIP_COLORS.map(c=><button key={c} type="button" aria-label={c} style={{background:c}} className={o.c===c?'is-on':''} onClick={()=>{setOpts(a=>a.map((y,j)=>j===i?{...y,c}:y));setColorAt(null);}}/>)}</span>}</span>
    <input className="zn-input" value={o.v} placeholder={`Option ${i+1}`} maxLength={100} onChange={e=>setOpts(a=>a.map((y,j)=>j===i?{...y,v:e.target.value}:y))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setOpts(a=>[...a.slice(0,i+1),{v:'',c:CHIP_COLORS[(a.length)%8],key:`n${Date.now()}`},...a.slice(i+1)]);}}}/>
    <button type="button" className="zs2-rule-x" aria-label="Remove option" disabled={opts.length<2} onClick={()=>setOpts(a=>a.filter((_,j)=>j!==i))}><Trash2 size={15}/></button>
   </li>)}</ul>
   <button type="button" className="zn-btn" onClick={()=>setOpts(a=>[...a,{v:'',c:CHIP_COLORS[a.length%8],key:`n${Date.now()}`}])}><Plus size={14}/>Add another item</button>
   <label className="zs2-rule-check"><input type="checkbox" checked={strict} onChange={e=>setStrict(e.target.checked)}/>Reject anything that isn&apos;t an option</label>
  </>:<p className="zn-nav-note">Each cell in the range shows a tick box. Ticked cells hold TRUE and unticked ones FALSE, so formulas like =COUNTIF({range||'B2:B100'},TRUE) work.</p>}
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot">{exists&&<button type="button" className="zn-btn" onClick={onRemove}>Remove rule</button>}<button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary">Done</button></div>
 </form></Modal>;
}

// Filter menu for one column: sort, then tick the values to show (like Google Sheets' "Filter by values").
function FilterPop({x,y,col,values,hidden,canEdit,onSort,onApply,onClose}:{x:number;y:number;col:string;values:[string,number][];hidden:string[];canEdit:boolean;onSort:(d:1|-1)=>void;onApply:(hide:string[])=>void;onClose:()=>void}){
 const [off,setOff]=useState(()=>new Set(hidden)),[q,setQ]=useState('');
 const shown=values.filter(([v])=>(v||'(Blanks)').toLowerCase().includes(q.toLowerCase()));
 const W=280,left=Math.max(8,Math.min(x-W,(typeof window!=='undefined'?window.innerWidth:1000)-W-8));
 return <div className="zs2-fpop" style={{left,top:y+4,width:W}} onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} role="dialog" aria-label={`Filter ${col}`}>
  <p className="zs2-fpop-title">{col}</p>
  {canEdit&&<><button type="button" className="zs2-fpop-row" onClick={()=>onSort(1)}><ArrowDownAZ size={15}/>Sort A → Z</button><button type="button" className="zs2-fpop-row" onClick={()=>onSort(-1)}><ArrowUpZA size={15}/>Sort Z → A</button><hr/></>}
  <p className="zs2-fpop-head">Filter by values</p>
  <div className="zs2-fpop-links"><button type="button" onClick={()=>setOff(new Set())}>Select all</button><button type="button" onClick={()=>setOff(new Set(values.map(([v])=>v)))}>Clear</button><span>{values.length-values.filter(([v])=>off.has(v)).length} of {values.length} shown</span></div>
  <input className="zs2-fpop-q" placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} autoComplete="off" spellCheck={false}/>
  <ul className="zs2-fpop-list">{shown.map(([v,n])=><li key={v}><label><input type="checkbox" checked={!off.has(v)} onChange={()=>setOff(s=>{const t=new Set(s);if(t.has(v))t.delete(v);else t.add(v);return t;})}/><span className={v?'':'is-blank'}>{v||'(Blanks)'}</span><em>{n}</em></label></li>)}
   {!shown.length&&<li className="zs2-fpop-none">No matches</li>}</ul>
  <div className="zs2-fpop-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={!canEdit} onClick={()=>onApply([...off])}>OK</button></div>
 </div>;
}

function mix(a:string,b:string,f:number){const p=(h:string)=>{const x=h.replace('#','');const n=parseInt(x.length===3?x.split('').map(y=>y+y).join(''):x,16);return [n>>16&255,n>>8&255,n&255];};
 const [x,y]=[p(a),p(b)];const t=Math.max(0,Math.min(1,f));return `#${x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}`;}
function cfTest(rule:CfRule,v:unknown,st:Style|undefined,formula:()=>unknown):boolean{
 const txt=show(v as never,st).toLowerCase(),a=(rule.a??'').toLowerCase(),na=Number(rule.a),nb=Number(rule.b);
 const n=typeof v==='number'?v:txt!==''&&!Number.isNaN(Number(txt))?Number(txt):NaN;
 const day=(s?:string)=>{if(!s)return NaN;const t2=s.trim().toLowerCase();const now=new Date();const today=dateToSerial(now.getFullYear(),now.getMonth(),now.getDate());
  if(t2==='today')return today;if(t2==='tomorrow')return today+1;if(t2==='yesterday')return today-1;return parseDateText(s)??(Number.isNaN(Number(s))?NaN:Number(s));};
 switch(rule.cond){
  case 'empty':return txt==='';case 'notEmpty':return txt!=='';
  case 'contains':return !!a&&txt.includes(a);case 'notContains':return !!a&&!txt.includes(a);
  case 'startsWith':return !!a&&txt.startsWith(a);case 'endsWith':return !!a&&txt.endsWith(a);case 'is':return txt===a;
  case 'gt':return n>na;case 'gte':return n>=na;case 'lt':return n<na;case 'lte':return n<=na;case 'eq':return n===na||txt===a;case 'neq':return !(n===na||txt===a);
  case 'between':return n>=Math.min(na,nb)&&n<=Math.max(na,nb);case 'notBetween':return !Number.isNaN(n)&&(n<Math.min(na,nb)||n>Math.max(na,nb));
  case 'before':return typeof v==='number'&&v<day(rule.a);case 'after':return typeof v==='number'&&v>day(rule.a);case 'onDate':return typeof v==='number'&&Math.floor(v)===day(rule.a);
  case 'checked':return v===true;
  case 'formula':{const r2=formula();return r2===true||(typeof r2==='number'&&r2!==0)||(typeof r2==='string'&&r2.toUpperCase()==='TRUE');}
 }}
const CF_LABELS:[CfRule['cond'],string,0|1|2][]=[['empty','Is empty',0],['notEmpty','Is not empty',0],['contains','Text contains',1],['notContains','Text does not contain',1],['startsWith','Text starts with',1],['endsWith','Text ends with',1],['is','Text is exactly',1],
 ['before','Date is before',1],['onDate','Date is',1],['after','Date is after',1],['gt','Greater than',1],['gte','Greater than or equal to',1],['lt','Less than',1],['lte','Less than or equal to',1],['eq','Is equal to',1],['neq','Is not equal to',1],['between','Is between',2],['notBetween','Is not between',2],['checked','Checkbox is ticked',0],['formula','Custom formula is',1]];
const CF_FILLS=['#b7e1cd','#fce8b2','#f4c7c3','#c6dafc','#e6d4f5','#fad2cf','#d9ead3','#fff2cc','#cfe2f3','#ead1dc','#57bb8a','#e67c73','#ffd666','#4285f4','#ffffff','#202124'];
// Conditional formatting panel: the rules on this tab, and an editor for one rule (single colour or colour scale).
function CfPanel({rules,range,onClose,onChange}:{rules:CfRule[];range:string;onClose:()=>void;onChange:(r:CfRule[])=>void}){
 const [edit,setEdit]=useState<CfRule|null>(rules.length?null:{id:newId(),range,cond:'notEmpty',fmt:{bg:'#b7e1cd'}});
 const describe=(x:CfRule)=>x.scale?'Colour scale':`${CF_LABELS.find(l=>l[0]===x.cond)?.[1]??''}${x.a?` ${x.a}`:''}${x.cond==='between'||x.cond==='notBetween'?` and ${x.b??''}`:''}`;
 if(edit)return <CfEditor rule={edit} onCancel={()=>rules.length?setEdit(null):onClose()} onSave={x=>{const i=rules.findIndex(y=>y.id===x.id);onChange(i>=0?rules.map(y=>y.id===x.id?x:y):[...rules,x]);setEdit(null);}}/>;
 return <Modal title="Conditional formatting" onClose={onClose}><div className="zn-modal-body zs2-cf">
  <ul className="zs2-cf-list">{rules.map(x=><li key={x.id}><button type="button" className="zs2-cf-item" onClick={()=>setEdit(x)}>
   <span className="zs2-cf-sw" style={x.scale?{background:`linear-gradient(90deg,${x.scale.min},${x.scale.mid??x.scale.min},${x.scale.max})`}:{background:x.fmt?.bg??'transparent',color:x.fmt?.color,fontWeight:x.fmt?.b?700:400,fontStyle:x.fmt?.i?'italic':undefined}}>123</span>
   <span><b>{describe(x)}</b><small>{x.range}</small></span></button>
   <button type="button" className="zs2-rule-x" aria-label="Delete rule" onClick={()=>onChange(rules.filter(y=>y.id!==x.id))}><Trash2 size={15}/></button></li>)}</ul>
  <button type="button" className="zn-btn" onClick={()=>setEdit({id:newId(),range,cond:'notEmpty',fmt:{bg:'#b7e1cd'}})}><Plus size={14}/>Add another rule</button>
  <div className="zn-modal-foot"><button type="button" className="zn-btn is-primary" onClick={onClose}>Done</button></div>
 </div></Modal>;
}
function CfEditor({rule,onCancel,onSave}:{rule:CfRule;onCancel:()=>void;onSave:(r:CfRule)=>void}){
 const [x,setX]=useState<CfRule>(rule),[err,setErr]=useState('');
 const args=CF_LABELS.find(l=>l[0]===x.cond)?.[2]??0;const f=x.fmt??{};
 const setF=(p:Partial<NonNullable<CfRule['fmt']>>)=>setX(y=>{const n={...(y.fmt??{}),...p};for(const kk of Object.keys(n) as (keyof typeof n)[])if(n[kk]===undefined)delete n[kk];return {...y,fmt:n};});
 function save(e:React.FormEvent){e.preventDefault();if(!parseRange(x.range)){setErr('Enter a range like A2:H100.');return;}if(!x.scale&&args>0&&!(x.a??'').trim()){setErr('Fill in the value.');return;}onSave(x);}
 return <Modal title="Conditional format rule" onClose={onCancel}><form className="zn-modal-body zs2-rule" onSubmit={save}>
  <label className="zn-label">Apply to range<input className="zn-input" value={x.range} onChange={e=>setX({...x,range:e.target.value})} spellCheck={false}/></label>
  <div className="zs2-rule-type" role="radiogroup" aria-label="Kind">{([['one','Single colour'],['scale','Colour scale']] as const).map(([v,l])=><button key={v} type="button" role="radio" aria-checked={(v==='scale')===!!x.scale} className={(v==='scale')===!!x.scale?'is-on':''} onClick={()=>setX(v==='scale'?{...x,scale:x.scale??{min:'#ffffff',max:'#57bb8a'}}:(()=>{const n={...x};delete n.scale;return n;})())}>{l}</button>)}</div>
  {x.scale?<div className="zs2-cf-scale">{(['min','mid','max'] as const).map(kk=><label key={kk} className="zn-label">{kk==='min'?'Lowest':kk==='mid'?'Middle (optional)':'Highest'}
    <span className="zs2-bcolors">{kk==='mid'&&<button type="button" aria-label="No middle colour" className={!x.scale!.mid?'is-on':''} style={{background:'var(--z-panel-2)'}} onClick={()=>setX({...x,scale:{...x.scale!,mid:undefined}})}/>}{CF_FILLS.map(c=><button key={c} type="button" aria-label={c} className={x.scale![kk]===c?'is-on':''} style={{background:c}} onClick={()=>setX({...x,scale:{...x.scale!,[kk]:c}})}/>)}</span></label>)}</div>
  :<>
   <label className="zn-label">Format cells if…<select className="zn-input" value={x.cond} onChange={e=>setX({...x,cond:e.target.value as CfRule['cond']})}>{CF_LABELS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   {args>0&&<input className="zn-input" placeholder={x.cond==='formula'?'=$C2="Posted"':x.cond==='before'||x.cond==='after'||x.cond==='onDate'?'today, or a date like 18/11/2026':'Value'} value={x.a??''} onChange={e=>setX({...x,a:e.target.value})}/>}
   {args>1&&<input className="zn-input" placeholder="and" value={x.b??''} onChange={e=>setX({...x,b:e.target.value})}/>}
   {x.cond==='formula'&&<p className="zn-nav-note">Write it for the first cell of the range; it moves along for the others. Use $ to pin a column, like <code>{'=$C2="Posted"'}</code> to colour whole rows.</p>}
   <div className="zn-label">Formatting style</div>
   <div className="zs2-cf-style">
    <span className="zs2-cf-sw is-big" style={{background:f.bg??'transparent',color:f.color,fontWeight:f.b?700:400,fontStyle:f.i?'italic':undefined,textDecoration:[f.u?'underline':'',f.s?'line-through':''].join(' ').trim()||undefined}}>Preview</span>
    {(['b','i','u','s'] as const).map(kk=><button key={kk} type="button" className={`zs2-cf-tog${f[kk]?' is-on':''}`} aria-label={kk} onClick={()=>setF({[kk]:f[kk]?undefined:1})}>{kk==='b'?<Bold size={15}/>:kk==='i'?<Italic size={15}/>:kk==='u'?<Underline size={15}/>:<Strikethrough size={15}/>}</button>)}
   </div>
   <div className="zn-label">Fill colour</div>
   <div className="zs2-bcolors"><button type="button" aria-label="No fill" className={!f.bg?'is-on':''} style={{background:'var(--z-panel-2)'}} onClick={()=>setF({bg:undefined})}/>{CF_FILLS.map(c=><button key={c} type="button" aria-label={c} className={f.bg===c?'is-on':''} style={{background:c}} onClick={()=>setF({bg:c})}/>)}</div>
   <div className="zn-label">Text colour</div>
   <div className="zs2-bcolors"><button type="button" aria-label="Default" className={!f.color?'is-on':''} style={{background:'var(--z-panel-2)'}} onClick={()=>setF({color:undefined})}/>{['#202124','#ffffff','#c5221f','#188038','#0b57d0','#b06000','#8430ce','#e37400'].map(c=><button key={c} type="button" aria-label={c} className={f.color===c?'is-on':''} style={{background:c}} onClick={()=>setF({color:c})}/>)}</div>
  </>}
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onCancel}>Cancel</button><button className="zn-btn is-primary">Done</button></div>
 </form></Modal>;
}
function LinkModal({init,onClose,onSave}:{init:{text:string;url:string};onClose:()=>void;onSave:(text:string,url:string)=>void}){
 const [text,setText]=useState(init.text),[url,setUrl]=useState(init.url);
 return <Modal title={init.url?'Edit link':'Insert link'} onClose={onClose}><form className="zn-modal-body" onSubmit={e=>{e.preventDefault();onSave(text,url);}}>
  <label className="zn-label">Text<input className="zn-input" value={text} onChange={e=>setText(e.target.value)} placeholder="What the cell shows"/></label>
  <label className="zn-label">Link<input className="zn-input" type="url" inputMode="url" autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></label>
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={!url.trim()&&!init.url}>Apply</button></div>
 </form></Modal>;
}
// Calendar under a date cell while it's being edited.
function DatePick({text,onPick}:{text:string;onPick:(serial:number)=>void}){
 const cur=parseDateText(text)??(/^\d+$/.test(text.trim())?Number(text):null);
 const base=cur!==null?serialToDate(cur):new Date();
 const [ym,setYm]=useState<[number,number]>(()=>cur!==null?[base.getUTCFullYear(),base.getUTCMonth()]:[base.getFullYear(),base.getMonth()]);
 const first=new Date(Date.UTC(ym[0],ym[1],1)),start=(first.getUTCDay()+6)%7,days=new Date(Date.UTC(ym[0],ym[1]+1,0)).getUTCDate();
 const now=new Date(),today=dateToSerial(now.getFullYear(),now.getMonth(),now.getDate());
 const step=(d:number)=>setYm(([y,m])=>{const n=new Date(Date.UTC(y,m+d,1));return [n.getUTCFullYear(),n.getUTCMonth()];});
 return <div className="zs2-cal" onMouseDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={e=>e.stopPropagation()}>
  <div className="zs2-cal-head"><button type="button" aria-label="Previous month" onClick={()=>step(-1)}><ChevronLeft size={16}/></button><b>{first.toLocaleString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})}</b><button type="button" aria-label="Next month" onClick={()=>step(1)}><ChevronRight size={16}/></button></div>
  <div className="zs2-cal-grid">{['M','T','W','T','F','S','S'].map((d,i)=><i key={i}>{d}</i>)}{Array.from({length:start},(_,i)=><span key={`b${i}`}/>)}
   {Array.from({length:days},(_,i)=>{const sn=dateToSerial(ym[0],ym[1],i+1);return <button key={i} type="button" className={`${sn===cur?'is-on':''}${sn===today?' is-today':''}`} onClick={()=>onPick(sn)}>{i+1}</button>;})}</div>
  <button type="button" className="zs2-cal-today" onClick={()=>onPick(today)}>Today</button>
 </div>;
}
function BorderGlyph({mode}:{mode:string}){
 const on=(k:string)=>({all:'tblrhv',inner:'hv',horizontal:'h',vertical:'v',outer:'tblr',left:'l',top:'t',right:'r',bottom:'b',clear:''} as Record<string,string>)[mode].includes(k);
 const L=(k:string,x1:number,y1:number,x2:number,y2:number)=><line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={on(k)?2:1} strokeDasharray={on(k)?undefined:'1.5 2'} opacity={on(k)?1:.45}/>;
 return <svg width="18" height="18" viewBox="0 0 18 18">{L('t',2,2,16,2)}{L('b',2,16,16,16)}{L('l',2,2,2,16)}{L('r',16,2,16,16)}{L('h',2,9,16,9)}{L('v',9,2,9,16)}</svg>;
}

const CHART_COLORS=['#4285f4','#ea4335','#fbbc04','#34a853','#ff6d01','#46bdc6','#7baaf7','#f07b72','#fcd04f','#71c287'];
type Series={name:string;vals:number[]};
// Reads a chart's range: optional header row (series names) and first column (labels); other columns are numbers.
function chartData(o:Obj,values:Record<string,unknown>,tab:Tab){
 const b=parseRange(o.range??'');if(!b)return {labels:[] as string[],series:[] as Series[]};
 let mr=-1;for(const x of Object.keys(tab.cells)){const p=parseRef(x);if(p&&p[0]>=b.c0&&p[0]<=b.c1&&p[1]>=b.r0&&p[1]<=b.r1)mr=Math.max(mr,p[1]);}
 const r1=Math.min(b.r1,mr<0?b.r0:mr),r0=o.head?b.r0+1:b.r0,c0=o.lab?b.c0+1:b.c0;
 const txt=(c:number,r:number)=>show(values[ref(c,r)] as never,tab.style?.[ref(c,r)]);
 const labels:string[]=[];for(let r=r0;r<=r1;r++)labels.push(o.lab?txt(b.c0,r):String(r-r0+1));
 const series:Series[]=[];for(let c=c0;c<=b.c1;c++){const vals:number[]=[];for(let r=r0;r<=r1;r++){const v=values[ref(c,r)];vals.push(typeof v==='number'?v:Number(v)||0);}series.push({name:o.head?txt(c,b.r0)||colName(c):colName(c),vals});}
 return {labels,series:series.slice(0,10)};
}
const nice=(lo:number,hi:number)=>{if(lo===hi){hi=lo+1;}const span=hi-lo,step0=Math.pow(10,Math.floor(Math.log10(span/5))),step=[1,2,2.5,5,10].map(m=>m*step0).find(s=>span/s<=6)??step0*10;
 const a=Math.floor(lo/step)*step,z=Math.ceil(hi/step)*step;const ticks:number[]=[];for(let t=a;t<=z+step/2;t+=step)ticks.push(Math.round(t*1e6)/1e6);return {a,z,ticks};};
const fmtTick=(n:number)=>Math.abs(n)>=1e6?`${Math.round(n/1e5)/10}M`:Math.abs(n)>=1e3?`${Math.round(n/100)/10}K`:String(n);
function ChartView({o,values,tab,w,h}:{o:Obj;values:Record<string,unknown>;tab:Tab;w:number;h:number}){
 const {labels,series}=chartData(o,values,tab);const type=o.type??'column';
 const top=o.title?34:14,legendH=series.length>1&&type!=='pie'?22:0,L=type==='bar'?Math.min(120,8+Math.max(20,...labels.map(l=>l.length*6.5))):44,R=16,B=type==='bar'?24:34,T=top+legendH;
 const pw=Math.max(10,w-L-R),ph=Math.max(10,h-T-B);
 if(!series.length||!labels.length)return <div className="zs2-chart-empty">Pick a range with numbers to chart.</div>;
 const title=o.title?<text x={w/2} y={22} textAnchor="middle" className="zs2-ch-title">{o.title}</text>:null;
 const legend=legendH?<g>{series.map((s2,i)=>{const x=L+i*Math.min(140,pw/series.length);return <g key={i} transform={`translate(${x},${top+4})`}><rect width={10} height={10} rx={2} fill={CHART_COLORS[i%10]}/><text x={14} y={9} className="zs2-ch-lab">{s2.name.slice(0,18)}</text></g>;})}</g>:null;
 if(type==='pie'){const vals=series[0].vals.map(v=>Math.max(0,v)),sum=vals.reduce((a,b)=>a+b,0)||1;const cx=Math.min(w*0.4,w/2),cy=(h+top)/2,rad=Math.max(10,Math.min(cx-20,(h-top)/2-12));const arcs:[number,number][]=[];{let ang=-Math.PI/2;for(const v of vals){const a2=ang+v/sum*Math.PI*2;arcs.push([ang,a2]);ang=a2;}}
  return <svg width={w} height={h} className="zs2-chart">{title}{vals.map((v,i)=>{const [ang,a2]=arcs[i];const large=a2-ang>Math.PI?1:0;const p=`M${cx},${cy} L${cx+rad*Math.cos(ang)},${cy+rad*Math.sin(ang)} A${rad},${rad} 0 ${large} 1 ${cx+rad*Math.cos(a2)},${cy+rad*Math.sin(a2)} Z`;const mid=(ang+a2)/2,pct=v/sum;
   return <g key={i}><path d={vals.length===1?`M${cx-rad},${cy} a${rad},${rad} 0 1,0 ${rad*2},0 a${rad},${rad} 0 1,0 ${-rad*2},0`:p} fill={CHART_COLORS[i%10]} stroke="var(--z-panel)" strokeWidth={1}/>{pct>0.06&&<text x={cx+rad*0.62*Math.cos(mid)} y={cy+rad*0.62*Math.sin(mid)+4} textAnchor="middle" className="zs2-ch-pct">{Math.round(pct*100)}%</text>}</g>;})}
   <g>{labels.slice(0,12).map((l,i)=><g key={i} transform={`translate(${cx+rad+24},${top+10+i*20})`}><rect width={10} height={10} rx={2} fill={CHART_COLORS[i%10]}/><text x={16} y={9} className="zs2-ch-lab">{l.slice(0,22)}</text></g>)}</g></svg>;}
 const all=series.flatMap(s2=>s2.vals);const stacked=!!o.stack&&(type==='column'||type==='bar'||type==='area');
 const sums=labels.map((_,i)=>series.reduce((a,s2)=>a+Math.max(0,s2.vals[i]??0),0));
 const {a,z,ticks}=nice(Math.min(0,...all),stacked?Math.max(...sums,0):Math.max(0,...all));
 const n=labels.length;
 if(type==='bar'){const sc=(v:number)=>L+(v-a)/(z-a)*pw,band=ph/n,bw=stacked?band*0.7:band*0.7/series.length;
  return <svg width={w} height={h} className="zs2-chart">{title}{legend}
   {ticks.map(t=><g key={t}><line x1={sc(t)} x2={sc(t)} y1={T} y2={T+ph} className="zs2-ch-grid"/><text x={sc(t)} y={T+ph+16} textAnchor="middle" className="zs2-ch-lab">{fmtTick(t)}</text></g>)}
   {labels.map((l,i)=><text key={i} x={L-6} y={T+band*i+band/2+4} textAnchor="end" className="zs2-ch-lab">{l.slice(0,16)}</text>)}
   {series.map((s2,si)=>s2.vals.map((v,i)=>{const base=stacked?series.slice(0,si).reduce((acc,x)=>acc+Math.max(0,x.vals[i]??0),0):0;const y=T+band*i+band*0.15+(stacked?0:si*bw);const x1=sc(Math.min(base,base+v)),x2=sc(Math.max(base,base+v));return <rect key={`${si}-${i}`} x={x1} y={y} width={Math.max(0,x2-x1)} height={bw-1} rx={2} fill={CHART_COLORS[si%10]}><title>{`${l(labels,i)}: ${v}`}</title></rect>;}))}</svg>;}
 const sy=(v:number)=>T+ph-(v-a)/(z-a)*ph,band=pw/n;
 const xAt=(i:number)=>type==='column'?L+band*i+band/2:L+(n===1?pw/2:pw*i/(n-1));
 const every=Math.max(1,Math.ceil(n/Math.max(1,Math.floor(pw/60))));
 return <svg width={w} height={h} className="zs2-chart">{title}{legend}
  {ticks.map(t=><g key={t}><line x1={L} x2={L+pw} y1={sy(t)} y2={sy(t)} className="zs2-ch-grid"/><text x={L-6} y={sy(t)+4} textAnchor="end" className="zs2-ch-lab">{fmtTick(t)}</text></g>)}
  {labels.map((lb,i)=>i%every?null:<text key={i} x={xAt(i)} y={T+ph+18} textAnchor="middle" className="zs2-ch-lab">{lb.slice(0,12)}</text>)}
  {type==='column'?series.map((s2,si)=>s2.vals.map((v,i)=>{const base=stacked?series.slice(0,si).reduce((acc,x)=>acc+Math.max(0,x.vals[i]??0),0):0;const bw=stacked?band*0.7:band*0.7/series.length;const x=L+band*i+band*0.15+(stacked?0:si*bw);const y1=sy(Math.max(base,base+v)),y2=sy(Math.min(base,base+v));return <rect key={`${si}-${i}`} x={x} y={y1} width={Math.max(1,bw-1)} height={Math.max(0,y2-y1)} rx={2} fill={CHART_COLORS[si%10]}><title>{`${l(labels,i)}: ${v}`}</title></rect>;}))
  :series.map((s2,si)=>{const pts=s2.vals.map((v,i)=>{const base=stacked?series.slice(0,si).reduce((acc,x)=>acc+(x.vals[i]??0),0):0;return [xAt(i),sy(base+v)] as const;});const line=pts.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ');
   return <g key={si}>{type==='area'&&<path d={`${line} L${pts.at(-1)![0]},${sy(Math.max(a,0))} L${pts[0][0]},${sy(Math.max(a,0))} Z`} fill={CHART_COLORS[si%10]} opacity={0.25}/>}
    {type!=='scatter'&&<path d={line} fill="none" stroke={CHART_COLORS[si%10]} strokeWidth={2}/>}
    {(type==='scatter'||n<=40)&&pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={type==='scatter'?4:2.5} fill={CHART_COLORS[si%10]}><title>{`${l(labels,i)}: ${s2.vals[i]}`}</title></circle>)}</g>;})}
  <line x1={L} x2={L+pw} y1={sy(Math.max(a,0))} y2={sy(Math.max(a,0))} className="zs2-ch-axis"/></svg>;
}
const l=(labels:string[],i:number)=>labels[i]??String(i+1);
const CHART_TYPES:[ChartType,string,React.ReactNode][]=[['column','Column',<ChartColumnBig key="c" size={18}/>],['bar','Bar',<ChartBarBig key="b" size={18}/>],['line','Line',<ChartLine key="l" size={18}/>],['area','Area',<ChartArea key="a" size={18}/>],['pie','Pie',<ChartPie key="p" size={18}/>],['scatter','Scatter',<ChartScatter key="s" size={18}/>]];
function ChartEditor({o,values,tab,onClose,onSave}:{o:Obj;values:Record<string,unknown>;tab:Tab;onClose:()=>void;onSave:(o:Obj)=>void}){
 const [x,setX]=useState<Obj>(o),[err,setErr]=useState('');
 const flag=(k2:'head'|'lab'|'stack',on:boolean)=>setX(y=>{const n={...y};if(on)n[k2]=1;else delete n[k2];return n;});
 return <Modal title="Chart" onClose={onClose} wide><form className="zn-modal-body zs2-chartedit" onSubmit={e=>{e.preventDefault();if(!parseRange(x.range??'')){setErr('Enter a range like A1:D20.');return;}onSave(x);}}>
  <div className="zs2-chart-preview"><ChartView o={x} values={values} tab={tab} w={520} h={260}/></div>
  <div className="zs2-chart-types">{CHART_TYPES.map(([v,lbl,ic])=><button key={v} type="button" className={(x.type??'column')===v?'is-on':''} onClick={()=>setX({...x,type:v})}>{ic}<span>{lbl}</span></button>)}</div>
  <label className="zn-label">Data range<input className="zn-input" value={x.range??''} onChange={e=>setX({...x,range:e.target.value})} spellCheck={false}/></label>
  <label className="zn-label">Title<input className="zn-input" value={x.title??''} maxLength={100} onChange={e=>setX({...x,title:e.target.value})} placeholder="Chart title"/></label>
  <label className="zs2-rule-check"><input type="checkbox" checked={!!x.head} onChange={e=>flag('head',e.target.checked)}/>Use the first row as headers</label>
  <label className="zs2-rule-check"><input type="checkbox" checked={!!x.lab} onChange={e=>flag('lab',e.target.checked)}/>Use the first column as labels</label>
  {(x.type==='column'||x.type==='bar'||x.type==='area'||!x.type)&&<label className="zs2-rule-check"><input type="checkbox" checked={!!x.stack} onChange={e=>flag('stack',e.target.checked)}/>Stacked</label>}
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary">Done</button></div>
 </form></Modal>;
}
function NoteEdit({init,onDone}:{init:string;onDone:(t:string)=>void}){
 const [t,setT]=useState(init);
 return <div className="zs2-noteedit" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
  <textarea autoFocus value={t} maxLength={5000} placeholder="Add a note" onChange={e=>setT(e.target.value)} onBlur={()=>onDone(t)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();onDone(init);}if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();onDone(t);}}}/>
 </div>;
}
const ago=(iso:string)=>{const m=Math.round((Date.now()-new Date(iso).getTime())/6e4);return m<1?'Just now':m<60?`${m}m`:m<1440?`${Math.round(m/60)}h`:new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'});};
function CommentPop({c,me,people,canEdit,onAdd,onResolve,onDelete,onClose}:{c?:Cmt;me:string;people:Record<string,{display_name?:string|null}|undefined>;canEdit:boolean;onAdd:(t:string)=>void;onResolve:()=>void;onDelete:()=>void;onClose:()=>void}){
 const [t,setT]=useState('');
 const msgs=c?[{u:c.u,t:c.t,at:c.at},...(c.re??[])]:[];
 return <div className="zs2-cmt" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
  {c&&<div className="zs2-cmt-head"><span>{msgs.length} comment{msgs.length===1?'':'s'}</span>{canEdit&&<button type="button" aria-label="Resolve" data-tip="Resolve" onClick={onResolve}><CircleCheck size={16}/></button>}{(c.u===me)&&<button type="button" aria-label="Delete thread" data-tip="Delete thread" onClick={onDelete}><Trash2 size={15}/></button>}</div>}
  {msgs.map((m,i)=><div key={i} className="zs2-cmt-msg"><Avatar m={people[m.u] as never} size={24}/><div><p><b>{m.u===me?'You':people[m.u]?.display_name??'Someone'}</b><small>{ago(m.at)}</small></p><p>{m.t}</p></div></div>)}
  <form onSubmit={e=>{e.preventDefault();if(!t.trim())return;onAdd(t);setT('');}}>
   <textarea autoFocus={!c} value={t} rows={c?1:2} maxLength={4000} placeholder={c?'Reply':'Comment'} onChange={e=>setT(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(t.trim()){onAdd(t);setT('');}}if(e.key==='Escape')onClose();}}/>
   {(t.trim()||!c)&&<div className="zs2-cmt-btns"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={!t.trim()}>{c?'Reply':'Comment'}</button></div>}
  </form>
 </div>;
}
