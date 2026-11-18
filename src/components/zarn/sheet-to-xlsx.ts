// Download a ZARN sheet as an Excel file: every tab, with formulas, number formats, merges, column widths,
// hidden rows and columns, links and notes. Charts, pictures, colours and borders stay in ZARN
// (the free SheetJS build doesn't write styles).
import {COL_W,evaluate,linkOf,parseRange,parseRef,show,type Style,type Tab} from '@/lib/sheet';

const fmtCode=(s?:Style)=>{if(!s?.fmt)return;const d=s.dec??2,z=d?`.${'0'.repeat(d)}`:'';
 if(s.fmt==='num')return `#,##0${z}`;if(s.fmt==='pct')return `0${z}%`;if(s.fmt==='date')return 'd mmm yyyy';if(s.fmt==='text')return '@';
 if(s.fmt==='cur')return `"${s.cur??'₦'}"#,##0${z}`;};

export async function sheetToXlsx(tabs:Tab[],title:string){
 const X=await import('xlsx');const wb=X.utils.book_new();const used=new Set<string>();
 for(const t of tabs){
  const vals=evaluate(t,tabs);const ws:import('xlsx').WorkSheet={};let mc=0,mr=0;
  for(const [k,raw] of Object.entries(t.cells)){const p=parseRef(k);if(!p||raw==='')continue;mc=Math.max(mc,p[0]);mr=Math.max(mr,p[1]);
   const v=vals[k],st=t.style?.[k];const cell:import('xlsx').CellObject=typeof v==='number'?{t:'n',v}:typeof v==='boolean'?{t:'b',v}:{t:'s',v:Array.isArray(v)?String(v[0]??''):String(v??'')};
   if(raw.startsWith('=')&&!/^=(IMAGE)\(/i.test(raw))cell.f=raw.slice(1);
   const z=fmtCode(st);if(z)cell.z=z;
   const u=linkOf(raw,show(v,st));if(u)cell.l={Target:u};
   if(t.notes?.[k])cell.c=[{a:'Note',t:t.notes[k]}];
   ws[k]=cell;}
  for(const [k,n] of Object.entries(t.notes??{}))if(!ws[k]&&n){ws[k]={t:'s',v:'',c:[{a:'Note',t:n}]};const p=parseRef(k);if(p){mc=Math.max(mc,p[0]);mr=Math.max(mr,p[1]);}}
  ws['!ref']=X.utils.encode_range({s:{c:0,r:0},e:{c:mc,r:mr}});
  const merges=(t.merges??[]).map(m=>parseRange(m)).filter(b=>!!b).map(b=>({s:{c:b.c0,r:b.r0},e:{c:b.c1,r:b.r1}}));if(merges.length)ws['!merges']=merges;
  const hc=new Set(t.hCols??[]);ws['!cols']=Array.from({length:mc+1},(_,c)=>({wpx:t.widths?.[c]??COL_W,...(hc.has(c)?{hidden:true}:{})}));
  if(t.hRows?.length){const rows:import('xlsx').RowInfo[]=[];for(const r of t.hRows)if(r<=mr)rows[r]={hidden:true};ws['!rows']=rows;}
  // Sheet names: max 31 chars, no []:*?/\ and unique.
  let name=(t.name||'Sheet').replace(/[[\]:*?/\\]/g,' ').slice(0,31).trim()||'Sheet',n=2;while(used.has(name.toLowerCase()))name=`${name.slice(0,27)} (${n++})`;used.add(name.toLowerCase());
  X.utils.book_append_sheet(wb,ws,name);
 }
 X.writeFile(wb,`${(title||'Sheet').replace(/[^\w\- ]+/g,'').trim()||'Sheet'}.xlsx`,{compression:true});
}
