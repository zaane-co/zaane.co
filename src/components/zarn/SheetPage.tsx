'use client';
/* eslint-disable react-hooks/refs -- menu items carry click handlers that use refs; they run on click, never during render */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AlignCenter,AlignLeft,AlignRight,Bold,Check,ChevronDown,ChevronRight,FileSpreadsheet,Italic,Loader2,Menu,PaintBucket,Percent,Plus,Printer,Redo2,Search,Share2,Sigma,Strikethrough,Underline,Undo2,WrapText,X,Eraser} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import ShareDoc from './ShareDoc';
import {Modal} from './Dialogs';
import {Avatar} from './format';
import {COLS,COL_W,FUNCTIONS,FUNCTION_NAMES,ROWS,ROW_H,adjustRefs,blankTab,colName,evaluate,isError,parseRef,readSheet,ref,shiftRefs,show,type SheetData,type Style,type Tab} from '@/lib/sheet';

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

// A spreadsheet in Drive, built to feel like Google Sheets: menus, a full toolbar, the name box and formula bar,
// a fast grid with frozen rows/columns, fill handle and resizable columns, formulas with suggestions, and live co-editing.
export default function SheetPage({id}:{id:string}){
 const {db,me,people,channels,title:chTitle}=useZarn(),router=useRouter(),confirm=useConfirm();
 const [row,setRow]=useState<Row|null|undefined>(undefined),[role,setRole]=useState<Role|null>(null);
 const [data,setData]=useState<SheetData>({tabs:[blankTab()]}),[tabId,setTabId]=useState(''),[title,setTitle]=useState('');
 const [sel,setSel]=useState<[number,number]>([0,0]),[anchor,setAnchor]=useState<[number,number]|null>(null);
 const [editing,setEditing]=useState<string|null>(null),[editMode,setEditMode]=useState<'type'|'edit'>('edit'),[editIn,setEditIn]=useState<'cell'|'bar'>('cell'),[pick,setPick]=useState(0);
 const [state,setState]=useState<'saved'|'saving'|'error'>('saved'),[sharing,setSharing]=useState(false),[crumbs,setCrumbs]=useState<{name:string;href:string}[]>([]);
 const [menu,setMenu]=useState<string|null>(null),[pop,setPop]=useState<string|null>(null),[ctx,setCtx]=useState<{x:number;y:number}|null>(null),[tabMenu,setTabMenu]=useState<string|null>(null),[renamingTab,setRenamingTab]=useState<string|null>(null);
 const [zoom,setZoom]=useState(1),[grid,setGrid]=useState(true),[find,setFind]=useState<{q:string;rep:string;at:number}|null>(null),[help,setHelp]=useState<'keys'|'fx'|null>(null);
 const [scroll,setScroll]=useState({top:0,h:800}),[drafts,setDrafts]=useState<Record<string,number>>({}),[fill,setFill]=useState<[number,number]|null>(null),[peers,setPeers]=useState<Record<string,Peer>>({}),[hl,setHl]=useState({u:0,r:0});
 const latest=useRef<{data:SheetData;title:string}>({data,title}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),live=useRef<ReturnType<typeof db.channel>|null>(null);
 const hist=useRef<{past:SheetData[];future:SheetData[]}>({past:[],future:[]}),clip=useRef<{cells:Record<string,string>;style:Record<string,Style>;box:Box;cut:boolean;text:string}|null>(null);
 const gridRef=useRef<HTMLDivElement>(null),cellIn=useRef<HTMLInputElement>(null),barIn=useRef<HTMLInputElement>(null),titleIn=useRef<HTMLInputElement>(null),csvIn=useRef<HTMLInputElement>(null);
 const drag=useRef<{kind:'sel'|'fill'|'fx'|'resize'|null;start?:[number,number];x?:number;w?:number;col?:number;at?:number;len?:number}>({kind:null});
 const canEdit=role==='owner'||role==='edit';

 // ---------- Load, save, live ----------
 useEffect(()=>{let on=true;void (async()=>{
  const [{data:d},{data:r}]=await Promise.all([db.from('zarn_docs').select('id,title,content,owner_id,kind,drive,folder_id,lead_id').eq('id',id).maybeSingle(),db.rpc('zarn_doc_role',{d:id})]);
  if(!on)return;
  if(d&&(d as Row).kind!=='sheet'){router.replace(`/zarn/docs/${id}`);return;}
  setRow((d as Row|null)??null);setRole((r as Role|null)??null);
  if(d){const s=readSheet((d as Row).content);setData(s);setTabId(s.tabs[0].id);setTitle((d as Row).title);latest.current={data:s,title:(d as Row).title};
   void db.from('zarn_drive_opens').upsert({user_id:me.user_id,kind:'doc',item_id:id,opened_at:new Date().toISOString()});}
 })();return()=>{on=false;};},[db,id,me.user_id,router]);
 useEffect(()=>{if(!row)return;let on=true;void (async()=>{
  const client=channels.find(c=>c.kind==='client'&&c.lead_id===row.lead_id);
  const root=row.drive==='team'?{name:'Team drive',href:'/zarn/drive?v=team'}:row.drive==='client'?{name:client?chTitle(client):'Client drive',href:`/zarn/drive?v=client&l=${row.lead_id}`}:row.owner_id===me.user_id?{name:'My Drive',href:'/zarn/drive'}:{name:'Shared with me',href:'/zarn/drive?v=shared'};
  const trail:{name:string;href:string}[]=[];let f=row.folder_id,h=0;
  while(f&&h<20){const {data:x}=await db.from('zarn_drive_folders').select('id,name,parent_id').eq('id',f).maybeSingle();if(!x)break;trail.unshift({name:x.name as string,href:`/zarn/drive?f=${x.id}`});f=x.parent_id as string|null;h++;}
  if(on)setCrumbs([root,...trail]);})();return()=>{on=false;};},[row,db,channels,chTitle,me.user_id]);

 const save=useCallback(async()=>{timer.current=null;setState('saving');
  const {error}=await db.from('zarn_docs').update({title:latest.current.title.trim()||'Untitled sheet',content:JSON.stringify(latest.current.data),updated_by:me.user_id}).eq('id',id);
  setState(error?'error':'saved');},[db,id,me.user_id]);
 const queue=useCallback(()=>{setState('saving');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void save(),700);},[save]);
 useEffect(()=>()=>{if(timer.current){clearTimeout(timer.current);void save();}},[save]);

 // Every change goes through here: it's undoable, saved, and sent to everyone else with the sheet open.
 const commit=useCallback((next:SheetData,edits?:Edit[],undoable=true)=>{
  if(undoable){hist.current.past.push(latest.current.data);if(hist.current.past.length>100)hist.current.past.shift();hist.current.future=[];}
  latest.current.data=next;setData(next);setHl({u:hist.current.past.length,r:hist.current.future.length});queue();
  void live.current?.send({type:'broadcast',event:edits?'cells':'full',payload:edits?{edits}:{data:next}});
 },[queue]);
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

 const tab=data.tabs.find(t=>t.id===tabId)??data.tabs[0];
 const values=useMemo(()=>evaluate(tab,data.tabs),[tab,data.tabs]);
 const k=ref(sel[0],sel[1]);
 useEffect(()=>{const t=setTimeout(()=>void live.current?.track({u:me.user_id,t:tab.id,s:k}),150);return()=>clearTimeout(t);},[k,tab.id,me.user_id]);
 const box:Box=useMemo(()=>{const a=anchor??sel;return {c0:Math.min(a[0],sel[0]),c1:Math.max(a[0],sel[0]),r0:Math.min(a[1],sel[1]),r1:Math.max(a[1],sel[1])};},[anchor,sel]);
 const keysIn=(b:Box)=>{const out:string[]=[];for(let r=b.r0;r<=b.r1;r++)for(let c=b.c0;c<=b.c1;c++)out.push(ref(c,r));return out;};
 const used=useMemo(()=>{let mc=-1,mr=-1;for(const x of Object.keys(tab.cells)){const p=parseRef(x);if(p){mc=Math.max(mc,p[0]);mr=Math.max(mr,p[1]);}}return {mc,mr};},[tab.cells]);
 const st=tab.style?.[k]??{};
 const width=(c:number)=>drafts[c]??tab.widths?.[c]??COL_W;
 const freeze=tab.freeze??{r:0,c:0};

 // ---------- Editing ----------
 const startEdit=(v:string,mode:'type'|'edit',where:'cell'|'bar'='cell')=>{if(!canEdit)return;setEditing(v);setEditMode(mode);setEditIn(where);setPick(0);};
 const commitEdit=(v:string|null=editing)=>{if(v===null)return;if(canEdit&&(tab.cells[k]??'')!==v)setCells([{tab:tab.id,k,v}]);setEditing(null);gridRef.current?.focus();};
 const move=(dc:number,dr:number,extend=false)=>{if(extend&&!anchor)setAnchor(sel);if(!extend)setAnchor(null);setSel(([c,r])=>[Math.max(0,Math.min(COLS-1,c+dc)),Math.max(0,Math.min(ROWS-1,r+dr))]);};
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
   return {...t,cells,style:move(t.style),widths};});
 }
 function sort(dir:1|-1,whole:boolean){
  if(!canEdit)return;const b=whole||(box.r0===box.r1&&box.c0===box.c1)?{r0:0,r1:Math.max(0,used.mr),c0:0,c1:Math.max(0,used.mc)}:box;const col=sel[0];
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
  const mod=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();
  if(mod&&key==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
  if(mod&&key==='y'){e.preventDefault();redo();return;}
  if(mod&&key==='b'){e.preventDefault();toggle('b');return;}if(mod&&key==='i'){e.preventDefault();toggle('i');return;}if(mod&&key==='u'){e.preventDefault();toggle('u');return;}
  if(mod&&key==='d'){e.preventDefault();fillDown(false);return;}if(mod&&key==='r'){e.preventDefault();fillDown(true);return;}
  if(mod&&key==='a'){e.preventDefault();setAnchor([0,0]);setSel([COLS-1,ROWS-1]);return;}
  if(mod&&key==='f'){e.preventDefault();setFind({q:'',rep:'',at:-1});return;}
  if(mod&&key==='/'){e.preventDefault();setHelp('keys');return;}
  if(mod&&e.key==='Home'){e.preventDefault();setAnchor(null);setSel([0,0]);return;}
  const jump=(dc:number,dr:number)=>{if(!mod)return move(dc,dr,e.shiftKey);const tc=dc>0?Math.max(used.mc,sel[0]):dc<0?0:sel[0],tr=dr>0?Math.max(used.mr,sel[1]):dr<0?0:sel[1];if(e.shiftKey&&!anchor)setAnchor(sel);if(!e.shiftKey)setAnchor(null);setSel([tc,tr]);};
  if(e.key==='ArrowUp'){e.preventDefault();jump(0,-1);}else if(e.key==='ArrowDown'){e.preventDefault();jump(0,1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();jump(-1,0);}else if(e.key==='ArrowRight'){e.preventDefault();jump(1,0);}
  else if(e.key==='Tab'){e.preventDefault();move(e.shiftKey?-1:1,0);}
  else if(e.key==='Enter'){e.preventDefault();if(e.shiftKey)move(0,-1);else startEdit(tab.cells[k]??'','edit');}
  else if(e.key==='F2'){e.preventDefault();startEdit(tab.cells[k]??'','edit');}
  else if((e.key==='Delete'||e.key==='Backspace')&&canEdit){e.preventDefault();setCells(keysIn(box).filter(x=>tab.cells[x]).map(x=>({tab:tab.id,k:x,v:''})));}
  else if(e.key==='Escape'){setAnchor(null);clip.current=null;}
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
  if(e.button===2){if(!(c>=box.c0&&c<=box.c1&&r>=box.r0&&r<=box.r1)){setAnchor(null);setSel([c,r]);}return;}
  if(pointing&&editing!==null){e.preventDefault();const add=ref(c,r);drag.current={kind:'fx',start:[c,r],at:editing.length,len:add.length};setEditing(editing+add);return;}
  if(editing!==null)commitEdit();
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
 useEffect(()=>{const close=()=>{setMenu(null);setPop(null);setCtx(null);setTabMenu(null);};window.addEventListener('click',close);return()=>window.removeEventListener('click',close);},[]);

 // ---------- Virtual scrolling: only the rows on screen are drawn ----------
 const rowH=ROW_H*zoom;
 const onScroll=()=>{const el=gridRef.current;if(el)setScroll({top:el.scrollTop,h:el.clientHeight});};
 useEffect(()=>{onScroll();const el=gridRef.current;if(!el)return;const ro=new ResizeObserver(onScroll);ro.observe(el);return()=>ro.disconnect();},[row]);
 const first=Math.max(freeze.r,Math.floor(scroll.top/rowH)-6),last=Math.min(ROWS-1,Math.ceil((scroll.top+scroll.h)/rowH)+6);
 useEffect(()=>{const el=gridRef.current;if(!el)return;const top=(sel[1]+1)*rowH,bottom=top+rowH;const lim=HEAD_H*zoom+freeze.r*rowH;
  if(sel[1]>=freeze.r){if(top-lim<el.scrollTop+0)el.scrollTop=Math.max(0,top-lim);else if(bottom>el.scrollTop+el.clientHeight)el.scrollTop=bottom-el.clientHeight+4;}
  let x=ROWHEAD_W;for(let c=0;c<sel[0];c++)x+=width(c);x*=zoom;let fx2=ROWHEAD_W;for(let c=0;c<freeze.c;c++)fx2+=width(c);fx2*=zoom;const w=width(sel[0])*zoom;
  if(sel[0]>=freeze.c){if(x<el.scrollLeft+fx2)el.scrollLeft=x-fx2;else if(x+w>el.scrollLeft+el.clientWidth)el.scrollLeft=x+w-el.clientWidth+4;}
 },[sel]); // eslint-disable-line react-hooks/exhaustive-deps
 const leftOf=(c:number)=>{let x=ROWHEAD_W;for(let i=0;i<c;i++)x+=width(i);return x;};

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
  File:[{label:'New sheet',run:()=>void newSheet()},{label:'Import CSV…',run:()=>csvIn.current?.click(),off:!canEdit},'-',{label:'Download as CSV (this tab)',run:download},{label:'Print',key:'⌘P',run:print},'-',{label:'Rename',run:()=>titleIn.current?.focus(),off:!canEdit},...(role==='owner'?[{label:'Share',run:()=>setSharing(true)} as Item,{label:'Move to trash',run:()=>void remove()} as Item]:[])],
  Edit:[{label:'Undo',key:'⌘Z',run:undo,off:!hl.u},{label:'Redo',key:'⌘⇧Z',run:redo,off:!hl.r},'-',{label:'Cut',key:'⌘X',run:()=>void menuCopy(true),off:!canEdit},{label:'Copy',key:'⌘C',run:()=>void menuCopy(false)},{label:'Paste',key:'⌘V',run:()=>void menuPaste(),off:!canEdit},'-',{label:'Delete values',key:'Del',run:()=>setCells(keysIn(box).filter(x=>tab.cells[x]).map(x=>({tab:tab.id,k:x,v:''}))),off:!canEdit},{label:'Fill down',key:'⌘D',run:()=>fillDown(false),off:!canEdit},{label:'Fill right',key:'⌘R',run:()=>fillDown(true),off:!canEdit},'-',{label:'Find and replace',key:'⌘F',run:()=>setFind({q:'',rep:'',at:-1})}],
  View:[{head:'Freeze'},{label:'No rows',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,r:0}})),on:!freeze.r,off:!canEdit},{label:'1 row',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,r:1}})),on:freeze.r===1,off:!canEdit},{label:'2 rows',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,r:2}})),on:freeze.r===2,off:!canEdit},{label:`Up to row ${sel[1]+1}`,run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,r:Math.min(sel[1]+1,20)}})),off:!canEdit},
   {label:'No columns',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,c:0}})),on:!freeze.c,off:!canEdit},{label:'1 column',run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,c:1}})),on:freeze.c===1,off:!canEdit},{label:`Up to column ${colName(sel[0])}`,run:()=>setTab(tab.id,t=>({...t,freeze:{...freeze,c:Math.min(sel[0]+1,10)}})),off:!canEdit},
   '-',{label:'Gridlines',run:()=>setGrid(g=>!g),on:grid},'-',{head:'Zoom'},...zooms.map(z=>({label:`${Math.round(z*100)}%`,run:()=>setZoom(z),on:zoom===z}) as Item)],
  Insert:[{label:`Row above`,run:()=>shift('r',box.r0,1),off:!canEdit},{label:'Row below',run:()=>shift('r',box.r1+1,1),off:!canEdit},{label:'Column left',run:()=>shift('c',box.c0,1),off:!canEdit},{label:'Column right',run:()=>shift('c',box.c1+1,1),off:!canEdit},'-',{label:'New tab',run:addTab,off:!canEdit},'-',{head:'Function'},...['SUM','AVERAGE','COUNT','MAX','MIN','IF','VLOOKUP'].map(n=>({label:n,run:()=>startEdit(`=${n}(`,'edit'),off:!canEdit}) as Item)],
  Format:[...fmtItems,'-',{head:'Text'},{label:'Bold',key:'⌘B',run:()=>toggle('b'),on:!!st.b,off:!canEdit},{label:'Italic',key:'⌘I',run:()=>toggle('i'),on:!!st.i,off:!canEdit},{label:'Underline',key:'⌘U',run:()=>toggle('u'),on:!!st.u,off:!canEdit},{label:'Strikethrough',run:()=>toggle('s'),on:!!st.s,off:!canEdit},'-',{head:'Alignment'},{label:'Left',run:()=>styleKeys(keysIn(box),s=>({...s,h:'l'})),on:st.h==='l',off:!canEdit},{label:'Centre',run:()=>styleKeys(keysIn(box),s=>({...s,h:'c'})),on:st.h==='c',off:!canEdit},{label:'Right',run:()=>styleKeys(keysIn(box),s=>({...s,h:'r'})),on:st.h==='r',off:!canEdit},{label:'Wrap text',run:()=>styleKeys(keysIn(box),s=>({...s,wrap:s.wrap?undefined:1})),on:!!st.wrap,off:!canEdit},'-',{label:'Clear formatting',key:'⌘\\',run:()=>styleKeys(keysIn(box),()=>({})),off:!canEdit}],
  Data:[{label:`Sort sheet by column ${colName(sel[0])}, A → Z`,run:()=>sort(1,true),off:!canEdit},{label:`Sort sheet by column ${colName(sel[0])}, Z → A`,run:()=>sort(-1,true),off:!canEdit},'-',{label:'Sort range A → Z',run:()=>sort(1,false),off:!canEdit},{label:'Sort range Z → A',run:()=>sort(-1,false),off:!canEdit}],
  Help:[{label:'Keyboard shortcuts',key:'⌘/',run:()=>setHelp('keys')},{label:'Function list',run:()=>setHelp('fx')}],
 };
 const renderItems=(items:Item[])=>items.map((it,i)=>it==='-'?<hr key={i}/>:'head' in it?<p key={i} className="zs2-mhead">{it.head}</p>:<button key={i} type="button" disabled={it.off} onClick={()=>{setMenu(null);setCtx(null);it.run?.();}}><span className="zs2-mcheck">{it.on&&<Check size={13}/>}</span><span>{it.label}</span>{it.key&&<kbd>{it.key}</kbd>}</button>);

 // ---------- Status (bottom-right): Sum, Average, Count of the selection ----------
 const stats=(()=>{if(box.c0===box.c1&&box.r0===box.r1)return null;const ns:number[]=[];let count=0;
  for(let r=box.r0;r<=Math.min(box.r1,used.mr);r++)for(let c=box.c0;c<=Math.min(box.c1,used.mc);c++){const v=values[ref(c,r)];if(v!==undefined&&v!==''){count++;if(typeof v==='number')ns.push(v);}}
  if(!count)return null;const sum=ns.reduce((a,b)=>a+b,0);return {sum,avg:ns.length?sum/ns.length:0,count,n:ns.length};})();

 // ---------- Grid rendering ----------
 const others=Object.values(peers).filter(p=>p.t===tab.id);
 const rowsToDraw=[...Array.from({length:freeze.r},(_,i)=>i),...(first<=last?Array.from({length:last-first+1},(_,i)=>first+i):[])];
 const cellStyle=(s:Style|undefined,c:number,r:number,num:boolean):React.CSSProperties=>({fontWeight:s?.b?700:undefined,fontStyle:s?.i?'italic':undefined,textDecoration:[s?.u?'underline':'',s?.s?'line-through':''].join(' ').trim()||undefined,
  color:s?.color,background:s?.bg,fontSize:s?.size?`${s.size}px`:undefined,textAlign:s?.h==='c'?'center':s?.h==='r'?'right':s?.h==='l'?'left':num&&s?.fmt!=='text'?'right':undefined,
  whiteSpace:s?.wrap?'normal':undefined,...(c<freeze.c?{position:'sticky',left:leftOf(c),zIndex:r<freeze.r?4:2}:{}),...(r<freeze.r?{position:'sticky',top:HEAD_H+r*ROW_H,zIndex:c<freeze.c?4:3}:{})});
 const totalW=leftOf(COLS);

 return <div className={`zn-page zs2${grid?'':' no-grid'}`} onContextMenu={e=>{if((e.target as HTMLElement).closest('.zs2-grid td'))e.preventDefault();}}>
  {sharing&&<ShareDoc docId={id} onClose={()=>setSharing(false)}/>}
  <input ref={csvIn} type="file" accept=".csv,text/csv" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importCsv(f);e.target.value='';}}/>

  <header className="zs2-top">
   <Link href={crumbs.at(-1)?.href??'/zarn/drive'} className="zs2-logo" aria-label="Back to Drive" data-tip="Back to Drive"><FileSpreadsheet size={26}/></Link>
   <div className="zs2-titles">
    <div className="zs2-titlerow"><input ref={titleIn} className="zs2-title" value={title} readOnly={!canEdit} maxLength={200} placeholder="Untitled sheet" aria-label="Title" onChange={e=>{setTitle(e.target.value);latest.current.title=e.target.value;queue();}} size={Math.max(8,title.length)}/>
     <span className="zs2-crumbs">{crumbs.map((c,i)=><span key={c.href}>{i>0&&<ChevronRight size={12}/>}<Link href={c.href}>{c.name}</Link></span>)}</span>
     <span className={`zs2-state${state==='error'?' is-error':''}`}>{!canEdit?'View only':state==='saving'?<><Loader2 size={12} className="zn-spin"/>Saving…</>:state==='error'?'Not saved':<><Check size={12}/>Saved to Drive</>}</span></div>
    <nav className="zs2-menubar" onClick={e=>e.stopPropagation()}>{Object.keys(menus).map(m=><span key={m} className="zs2-mwrap"><button type="button" className={menu===m?'is-on':''} onClick={()=>setMenu(x=>x===m?null:m)} onMouseEnter={()=>{if(menu&&menu!==m)setMenu(m);}}>{m}</button>
     {menu===m&&<div className="zs2-menu" role="menu">{renderItems(menus[m])}</div>}</span>)}</nav>
   </div>
   <div className="zs2-right">
    {Object.values(peers).length>0&&<span className="zs2-peers">{Object.values(peers).slice(0,5).map(p=><span key={p.u} style={{boxShadow:`0 0 0 2px ${colorOf(p.u)}`}} title={people[p.u]?.display_name}><Avatar m={people[p.u]} size={28}/></span>)}</span>}
    {role==='owner'&&<button type="button" className="zs2-share" onClick={()=>setSharing(true)}><Share2 size={15}/>Share</button>}
   </div>
  </header>

  <div className="zs2-toolbar" onClick={e=>e.stopPropagation()}>
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
    {pop==='fmt'&&<div className="zs2-menu">{renderItems(fmtItems)}</div>}</span>
   <i className="zs2-sep"/>
   <span className="zs2-sel"><select aria-label="Font size" disabled={!canEdit} value={st.size??13} onChange={e=>{const v=Number(e.target.value);styleKeys(keysIn(box),s=>({...s,size:v===13?undefined:v}));}}>{fontSizes.map(f=><option key={f} value={f}>{f}</option>)}</select></span>
   <i className="zs2-sep"/>
   <button type="button" data-tip="Bold (⌘B)" aria-label="Bold" disabled={!canEdit} className={st.b?'is-on':''} onClick={()=>toggle('b')}><Bold size={16}/></button>
   <button type="button" data-tip="Italic (⌘I)" aria-label="Italic" disabled={!canEdit} className={st.i?'is-on':''} onClick={()=>toggle('i')}><Italic size={16}/></button>
   <button type="button" data-tip="Strikethrough" aria-label="Strikethrough" disabled={!canEdit} className={st.s?'is-on':''} onClick={()=>toggle('s')}><Strikethrough size={16}/></button>
   <button type="button" data-tip="Underline (⌘U)" aria-label="Underline" disabled={!canEdit} className={st.u?'is-on':''} onClick={()=>toggle('u')}><Underline size={16}/></button>
   <span className="zs2-popwrap"><button type="button" data-tip="Text colour" aria-label="Text colour" disabled={!canEdit} onClick={()=>setPop(p=>p==='color'?null:'color')}><span className="zs2-a" style={{borderColor:st.color??'currentColor'}}>A</span></button>
    {pop==='color'&&<div className="zs2-colors"><button type="button" className="zs2-reset" onClick={()=>{setPop(null);styleKeys(keysIn(box),s=>({...s,color:undefined}));}}>Reset</button><div>{palette.map(c=><button key={c} type="button" aria-label={c} style={{background:c}} onClick={()=>{setPop(null);styleKeys(keysIn(box),s=>({...s,color:c}));}}/>)}</div></div>}</span>
   <span className="zs2-popwrap"><button type="button" data-tip="Fill colour" aria-label="Fill colour" disabled={!canEdit} onClick={()=>setPop(p=>p==='fill'?null:'fill')}><PaintBucket size={16}/><span className="zs2-bar" style={{background:st.bg??'transparent'}}/></button>
    {pop==='fill'&&<div className="zs2-colors"><button type="button" className="zs2-reset" onClick={()=>{setPop(null);styleKeys(keysIn(box),s=>({...s,bg:undefined}));}}>Reset</button><div>{palette.map(c=><button key={c} type="button" aria-label={c} style={{background:c}} onClick={()=>{setPop(null);styleKeys(keysIn(box),s=>({...s,bg:c}));}}/>)}</div></div>}</span>
   <i className="zs2-sep"/>
   <button type="button" data-tip="Align left" aria-label="Align left" disabled={!canEdit} className={st.h==='l'?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,h:s.h==='l'?undefined:'l'}))}><AlignLeft size={16}/></button>
   <button type="button" data-tip="Align centre" aria-label="Align centre" disabled={!canEdit} className={st.h==='c'?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,h:s.h==='c'?undefined:'c'}))}><AlignCenter size={16}/></button>
   <button type="button" data-tip="Align right" aria-label="Align right" disabled={!canEdit} className={st.h==='r'?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,h:s.h==='r'?undefined:'r'}))}><AlignRight size={16}/></button>
   <button type="button" data-tip="Wrap text" aria-label="Wrap text" disabled={!canEdit} className={st.wrap?'is-on':''} onClick={()=>styleKeys(keysIn(box),s=>({...s,wrap:s.wrap?undefined:1}))}><WrapText size={16}/></button>
   <button type="button" data-tip="Clear formatting" aria-label="Clear formatting" disabled={!canEdit} onClick={()=>styleKeys(keysIn(box),()=>({}))}><Eraser size={16}/></button>
   <i className="zs2-sep"/>
   <span className="zs2-popwrap"><button type="button" data-tip="Functions" aria-label="Functions" disabled={!canEdit} onClick={()=>setPop(p=>p==='fx'?null:'fx')}><Sigma size={16}/><ChevronDown size={12}/></button>
    {pop==='fx'&&<div className="zs2-menu">{['SUM','AVERAGE','COUNT','MAX','MIN'].map(n=><button key={n} type="button" onClick={()=>{setPop(null);if(box.r1>box.r0||box.c1>box.c0){const target=box.r1+1<ROWS?ref(box.c0,box.r1+1):ref(box.c1+1,box.r0);setCells([{tab:tab.id,k:target,v:`=${n}(${ref(box.c0,box.r0)}:${ref(box.c1,box.r1)})`}]);}else startEdit(`=${n}(`,'edit');}}><span className="zs2-mcheck"/><span>{n}</span></button>)}<hr/><button type="button" onClick={()=>{setPop(null);setHelp('fx');}}><span className="zs2-mcheck"/><span>All functions…</span></button></div>}</span>
  </div>

  <div className="zs2-fbar">
   <input className="zs2-name" aria-label="Name box" defaultValue={box.c0===box.c1&&box.r0===box.r1?k:`${ref(box.c0,box.r0)}:${ref(box.c1,box.r1)}`} key={`${k}-${box.c0}-${box.r0}-${box.c1}-${box.r1}`}
    onKeyDown={e=>{if(e.key!=='Enter')return;const v=e.currentTarget.value.toUpperCase().trim();const [a,b]=v.split(':');const p=parseRef(a),q=b?parseRef(b):null;if(p){if(q){setAnchor(p);setSel(q);}else{setAnchor(null);setSel(p);}gridRef.current?.focus();}}}/>
   <span className="zs2-fx">fx</span>
   <input ref={barIn} className="zs2-formula" value={editing??tab.cells[k]??''} readOnly={!canEdit} aria-label="Cell contents"
    onFocus={()=>{if(editing===null&&canEdit)startEdit(tab.cells[k]??'','edit','bar');else setEditIn('bar');}} onChange={e=>setEditing(e.target.value)} onKeyDown={onEditKey}/>
  </div>

  <div ref={gridRef} className="zs2-grid" tabIndex={0} onKeyDown={onKey} onCopy={e=>onCopy(e)} onCut={e=>onCopy(e,true)} onPaste={onPaste} onScroll={onScroll} data-lenis-prevent>
   <table style={{width:totalW,zoom}}>
    <colgroup><col style={{width:ROWHEAD_W}}/>{Array.from({length:COLS},(_,c)=><col key={c} style={{width:width(c)}}/>)}</colgroup>
    <thead><tr>
     <th className="zs2-corner" onMouseDown={()=>{setAnchor([0,0]);setSel([COLS-1,ROWS-1]);}}/>
     {Array.from({length:COLS},(_,c)=><th key={c} className={`${c>=box.c0&&c<=box.c1?'is-hl':''}${box.r0===0&&box.r1===ROWS-1&&c>=box.c0&&c<=box.c1?' is-full':''}`} style={c<freeze.c?{left:leftOf(c),zIndex:6}:undefined}
      onMouseDown={e=>{if((e.target as HTMLElement).classList.contains('zs2-resize'))return;if(editing!==null)commitEdit();if(e.shiftKey&&anchor){setAnchor([anchor[0],0]);setSel([c,ROWS-1]);}else{setAnchor([c,0]);setSel([c,ROWS-1]);}drag.current={kind:null};gridRef.current?.focus();}}
      onContextMenu={e=>{e.preventDefault();if(!(c>=box.c0&&c<=box.c1&&box.r0===0&&box.r1===ROWS-1)){setAnchor([c,0]);setSel([c,ROWS-1]);}setCtx({x:e.clientX,y:e.clientY});}}>
      {colName(c)}{canEdit&&<span className="zs2-resize" onMouseDown={e=>{e.stopPropagation();drag.current={kind:'resize',col:c,x:e.clientX,w:width(c)};}} onDoubleClick={()=>setTab(tab.id,t=>{const w={...(t.widths??{})};delete w[c];return {...t,widths:w};})}/>}
      {c===freeze.c-1&&<span className="zs2-freeze-v"/>}</th>)}
    </tr></thead>
    <tbody>
     {rowsToDraw.map((r,i)=><FragmentRow key={r} gapBefore={i===freeze.r&&r>freeze.r?(r-freeze.r)*ROW_H:0}>
      <tr style={{height:ROW_H}}>
       <th className={`zs2-rh${r>=box.r0&&r<=box.r1?' is-hl':''}${box.c0===0&&box.c1===COLS-1&&r>=box.r0&&r<=box.r1?' is-full':''}${r===freeze.r-1?' is-freeze':''}`} style={r<freeze.r?{top:HEAD_H+r*ROW_H,zIndex:5}:undefined}
        onMouseDown={e=>{if(editing!==null)commitEdit();if(e.shiftKey&&anchor){setAnchor([0,anchor[1]]);setSel([COLS-1,r]);}else{setAnchor([0,r]);setSel([COLS-1,r]);}gridRef.current?.focus();}}
        onContextMenu={e=>{e.preventDefault();if(!(r>=box.r0&&r<=box.r1&&box.c0===0&&box.c1===COLS-1)){setAnchor([0,r]);setSel([COLS-1,r]);}setCtx({x:e.clientX,y:e.clientY});}}>{r+1}</th>
       {Array.from({length:COLS},(_,c)=>{const x=ref(c,r),s=tab.style?.[x],v=values[x],cur=c===sel[0]&&r===sel[1],inside=c>=box.c0&&c<=box.c1&&r>=box.r0&&r<=box.r1,peer=others.find(p=>p.s===x);
        const fillTarget=fill&&(()=>{const down=Math.abs(fill[1]-box.r1)>=Math.abs(fill[0]-box.c1);return down?(c>=box.c0&&c<=box.c1&&((fill[1]>box.r1&&r>box.r1&&r<=fill[1])||(fill[1]<box.r0&&r<box.r0&&r>=fill[1]))):(r>=box.r0&&r<=box.r1&&((fill[0]>box.c1&&c>box.c1&&c<=fill[0])||(fill[0]<box.c0&&c<box.c0&&c>=fill[0])));})();
        const edges=inside?`${r===box.r0?' t':''}${r===box.r1?' b':''}${c===box.c0?' l':''}${c===box.c1?' r':''}`:'';
        return <td key={c} className={`${inside&&!cur?'is-in':''}${edges?` is-edge${edges}`:''}${cur?' is-cur':''}${isError(v)?' is-err':''}${fillTarget?' is-fill':''}${c===freeze.c-1?' is-fz-c':''}${r===freeze.r-1?' is-fz-r':''}`} style={cellStyle(s,c,r,typeof v==='number')}
         onMouseDown={e=>cellDown(e,c,r)} onMouseEnter={()=>cellEnter(c,r)} onDoubleClick={()=>startEdit(tab.cells[x]??'','edit')} onContextMenu={e=>{e.preventDefault();setCtx({x:e.clientX,y:e.clientY});}}>
         {cur&&editing!==null&&editIn==='cell'?<input ref={cellIn} className="zs2-in" value={editing} onChange={e=>setEditing(e.target.value)} onKeyDown={onEditKey} onBlur={e=>{if(!drag.current.kind&&!(e.relatedTarget as HTMLElement|null)?.closest('.zs2-fbar,.zs2-suggest'))commitEdit();}}/>:show(v,s)}
         {cur&&canEdit&&editing===null&&box.c0===box.c1&&box.r0===box.r1&&<span className="zs2-handle" onMouseDown={e=>{e.stopPropagation();e.preventDefault();drag.current={kind:'fill'};}}/>}
         {!cur&&c===box.c1&&r===box.r1&&canEdit&&editing===null&&(box.c0!==box.c1||box.r0!==box.r1)&&<span className="zs2-handle" onMouseDown={e=>{e.stopPropagation();e.preventDefault();drag.current={kind:'fill'};}}/>}
         {peer&&<span className="zs2-peer" style={{borderColor:colorOf(peer.u)}}><em style={{background:colorOf(peer.u)}}>{people[peer.u]?.display_name?.split(' ')[0]??'Someone'}</em></span>}
         {cur&&editing!==null&&editIn==='cell'&&(fx.list.length>0||fx.help)&&<div className="zs2-suggest" onMouseDown={e=>e.preventDefault()}>
          {fx.list.map((n,j)=><button key={n} type="button" className={j===pick?'is-on':''} onClick={()=>acceptFx(n)}><b>{n}</b><small>{FUNCTIONS[n].help}</small></button>)}
          {!fx.list.length&&fx.help&&<p>{fx.help}</p>}</div>}
        </td>;})}
      </tr></FragmentRow>)}
     <tr style={{height:Math.max(0,(ROWS-1-last)*ROW_H)}}><td colSpan={COLS+1} className="zs2-spacer"/></tr>
    </tbody>
   </table>
  </div>

  <footer className="zs2-foot" onClick={e=>e.stopPropagation()}>
   {canEdit&&<button type="button" className="zs2-ticon" aria-label="Add tab" data-tip="Add tab" onClick={addTab}><Plus size={16}/></button>}
   <span className="zs2-popwrap"><button type="button" className="zs2-ticon" aria-label="All tabs" data-tip="All tabs" onClick={()=>setPop(p=>p==='tabs'?null:'tabs')}><Menu size={16}/></button>
    {pop==='tabs'&&<div className="zs2-menu is-up">{data.tabs.map(t=><button key={t.id} type="button" onClick={()=>{setPop(null);setTabId(t.id);setSel([0,0]);setAnchor(null);}}><span className="zs2-mcheck">{t.id===tab.id&&<Check size={13}/>}</span><span>{t.name}</span></button>)}</div>}</span>
   <div className="zs2-tabs">{data.tabs.map(t=><span key={t.id} className={`zs2-tab${t.id===tab.id?' is-on':''}`} style={t.color?{boxShadow:`inset 0 -3px 0 ${t.color}`}:undefined}>
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
    {label:'Clear contents',run:()=>setCells(keysIn(box).filter(x=>tab.cells[x]).map(x=>({tab:tab.id,k:x,v:''}))),off:!canEdit},'-',
    {label:'Sort range A → Z',run:()=>sort(1,false),off:!canEdit},{label:'Sort range Z → A',run:()=>sort(-1,false),off:!canEdit}])}
  </div>}

  {find&&<div className="zs2-find" onClick={e=>e.stopPropagation()}>
   <Search size={15}/><input autoFocus placeholder="Find in sheet" value={find.q} onChange={e=>setFind({...find,q:e.target.value,at:-1})} onKeyDown={e=>{if(e.key==='Enter')findNext();if(e.key==='Escape'){setFind(null);gridRef.current?.focus();}}}/>
   <small>{find.q?matches.length?`${find.at+1>0?find.at+1:0} of ${matches.length}`:'No results':''}</small>
   <button type="button" onClick={findNext} disabled={!matches.length}>Next</button>
   {canEdit&&<><input placeholder="Replace with" value={find.rep} onChange={e=>setFind({...find,rep:e.target.value})}/><button type="button" onClick={replaceAll} disabled={!find.q}>Replace all</button></>}
   <button type="button" aria-label="Close" onClick={()=>{setFind(null);gridRef.current?.focus();}}><X size={15}/></button>
  </div>}

  {help==='keys'&&<Modal title="Keyboard shortcuts" onClose={()=>setHelp(null)} wide><div className="zn-modal-body"><dl className="zs2-keys">{([['Arrow keys','Move'],['Shift + arrows','Select a range'],['⌘ + arrows','Jump to the edge of the data'],['Enter / F2','Edit the cell'],['Type','Replace the cell'],['Tab / Shift+Tab','Move right / left'],['Delete','Clear the selection'],['⌘C / ⌘X / ⌘V','Copy / cut / paste'],['⌘Z / ⌘⇧Z','Undo / redo'],['⌘D / ⌘R','Fill down / right'],['⌘B / ⌘I / ⌘U','Bold / italic / underline'],['⌘A','Select all'],['⌘F','Find and replace'],['Drag the blue square','Fill or continue formulas'],['Click cells while typing =','Insert references']] as const).map(([a,b])=><div key={a}><dt><kbd>{a}</kbd></dt><dd>{b}</dd></div>)}</dl></div></Modal>}
  {help==='fx'&&<Modal title="Functions" onClose={()=>setHelp(null)} wide><div className="zn-modal-body"><ul className="zs2-fxlist">{FUNCTION_NAMES.map(n=><li key={n}><b>{n}</b><code>{FUNCTIONS[n].help}</code></li>)}</ul></div></Modal>}
 </div>;
}

// A row with an optional spacer before it (for the rows scrolled out of view between the frozen rows and the visible ones).
function FragmentRow({gapBefore,children}:{gapBefore:number;children:React.ReactNode}){
 return <>{gapBefore>0&&<tr style={{height:gapBefore}}><td colSpan={COLS+1} className="zs2-spacer"/></tr>}{children}</>;
}
