// Reads an Excel / CSV / ODS file into a ZARN sheet: every tab, values and formulas, fill colours, column widths and
// frozen header rows. Empty pre-formatted cells are skipped, and anything past ZARN's grid size is left out.
import {CHIP_COLORS,COLS,ROWS,colIndex,parseRange,ref,type Rule,type SheetData,type Style,type Tab} from '@/lib/sheet';
type XLib=typeof import('xlsx');
const ent=(s:string)=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attr=(a:string,n:string)=>{const m=new RegExp(`\\b${n}="([^"]*)"`).exec(a);return m?ent(m[1]):'';};
// Dropdowns (list validation) and tick boxes, with chip colours taken from "cell equals / contains" conditional formats.
// SheetJS doesn't read these, so they come straight from the sheet XML inside the .xlsx.
function readRules(X:XLib,buf:ArrayBuffer,wb:import('xlsx').WorkBook):Record<string,Rule[]>{
 const out:Record<string,Rule[]>={};
 try{
  const cfb=X.CFB.read(new Uint8Array(buf),{type:'array'});
  const files=new Map<string,Uint8Array>();cfb.FullPaths.forEach((fp:string,i:number)=>{const c=cfb.FileIndex[i]?.content;if(c)files.set(fp.replace(/^Root Entry\//,'').replace(/^\//,''),c as Uint8Array);});
  const get=(p:string)=>{const c=files.get(p);return c?new TextDecoder().decode(c):'';};
  const wbx=get('xl/workbook.xml'),rels=get('xl/_rels/workbook.xml.rels'),styles=get('xl/styles.xml');
  const dxf=[...(/<dxfs[^>]*>([\s\S]*?)<\/dxfs>/.exec(styles)?.[1]??'').matchAll(/<dxf>([\s\S]*?)<\/dxf>/g)].map(m=>{const c=/<fill>[\s\S]*?<(?:bgColor|fgColor) rgb="([0-9A-Fa-f]{6,8})"/.exec(m[1]);return c?`#${c[1].slice(-6).toLowerCase()}`:undefined;});
  const target:Record<string,string>={};for(const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g))target[attr(m[1],'Id')]=attr(m[1],'Target');
  for(const m of wbx.matchAll(/<sheet\b([^>]*)\/?>/g)){
   const name=attr(m[1],'name'),t=target[attr(m[1],'r:id')];if(!name||!t)continue;
   const xml=get(t.startsWith('/')?t.slice(1):`xl/${t.replace(/^\.\//,'')}`);if(!xml)continue;
   // Option colours: cell-equals and text-contains rules with a fill.
   const colorOf:Record<string,string>={};
   for(const cf of xml.matchAll(/<cfRule\b([^>]*)>([\s\S]*?)<\/cfRule>/g)){const d=dxf[Number(attr(cf[1],'dxfId'))];if(!d)continue;
    const txt=attr(cf[1],'text')||(/<formula>"((?:[^"]|"")*)"<\/formula>/.exec(ent(cf[2]))?.[1]??'').replace(/""/g,'"');if(txt)colorOf[txt.toLowerCase()]=d;}
   const list:Rule[]=[];
   const add=(type:string,f1:string,sqref:string)=>{if(type!=='list'||!f1)return;let opts:string[]=[];
    if(f1.startsWith('"'))opts=f1.slice(1,-1).split(',').map(x=>x.trim()).filter(Boolean);
    else{const [sh,rg]=f1.includes('!')?[f1.slice(0,f1.lastIndexOf('!')).replace(/^'|'$/g,''),f1.slice(f1.lastIndexOf('!')+1)]:[name,f1];const ws=wb.Sheets[sh];const b=parseRange(rg);
     if(ws&&b)for(let r=b.r0;r<=b.r1&&opts.length<200;r++)for(let c=b.c0;c<=b.c1;c++){const cell=ws[ref(c,r)] as {w?:string;v?:unknown}|undefined;const v=String(cell?.w??cell?.v??'').trim();if(v&&!opts.includes(v))opts.push(v);}}
    if(!opts.length)return;
    const check=opts.length===2&&opts.every(o=>/^(true|false)$/i.test(o));
    for(const rg of sqref.split(/\s+/).filter(Boolean)){if(!parseRange(rg))continue;
     list.push(check?{id:Math.random().toString(36).slice(2,10),range:rg,t:'check'}:{id:Math.random().toString(36).slice(2,10),range:rg,t:'list',opts:opts.map((v,i)=>({v,c:colorOf[v.toLowerCase()]??CHIP_COLORS[i%8]}))});}};
   for(const dv of xml.matchAll(/<dataValidation\b([^>]*)>([\s\S]*?)<\/dataValidation>/g))add(attr(dv[1],'type'),ent(/<formula1>([\s\S]*?)<\/formula1>/.exec(dv[2])?.[1]??'').trim(),attr(dv[1],'sqref'));
   for(const dv of xml.matchAll(/<x14:dataValidation\b([^>]*)>([\s\S]*?)<\/x14:dataValidation>/g))add(attr(dv[1],'type'),ent(/<x14:formula1>\s*<xm:f>([\s\S]*?)<\/xm:f>/.exec(dv[2])?.[1]??'').trim(),/<xm:sqref>([\s\S]*?)<\/xm:sqref>/.exec(dv[2])?.[1]??'');
   if(list.length)out[name]=list.slice(0,200);
  }
 }catch{/* a file without readable XML still imports its values */}
 return out;
}
export async function fileToSheet(buf:ArrayBuffer,name:string):Promise<{data:SheetData;cut:boolean}>{
 const X=await import('xlsx');
 const csv=/\.(csv|tsv|txt)$/i.test(name);
 const wb=csv?X.read(new TextDecoder().decode(buf),{type:'string',raw:false}):X.read(new Uint8Array(buf),{type:'array',cellStyles:true,cellFormula:true,dense:false});
 let cut=false;const tabs:Tab[]=[];const rules=csv?{}:readRules(X,buf,wb);
 for(const [i,sn] of wb.SheetNames.slice(0,20).entries()){
  const ws=wb.Sheets[sn]!,cells:Record<string,string>={},style:Record<string,Style>={},widths:Record<string,number>={};
  for(const k of Object.keys(ws)){
   if(k[0]==='!')continue;
   const c=ws[k] as {t?:string;v?:unknown;w?:string;f?:string;z?:string;s?:{patternType?:string;fgColor?:{rgb?:string}}};
   const hasValue=c.f!==undefined||(c.v!==undefined&&c.v!==null&&c.v!=='');
   const m=k.match(/^([A-Z]+)(\d+)$/);if(!m)continue;
   const col=colIndex(m[1]!),row=Number(m[2])-1;
   const bg=c.s?.patternType==='solid'&&c.s.fgColor?.rgb?`#${c.s.fgColor.rgb.slice(-6).toLowerCase()}`:undefined;
   if(!hasValue&&!bg)continue;
   if(col>=COLS||row>=ROWS){if(hasValue)cut=true;continue;}
   if(hasValue){
    const dateLike=typeof c.z==='string'&&/[dmy]/i.test(c.z)&&!/general/i.test(c.z);
    cells[k]=c.f!==undefined?`=${c.f}`:c.t==='n'&&!dateLike?String(c.v):c.t==='b'?(c.v?'TRUE':'FALSE'):(c.w??String(c.v));
   }
   if(bg&&bg!=='#ffffff'&&bg!=='#000000')style[k]={...style[k],bg};
  }
  for(const [ci,cw] of ((ws['!cols']??[]) as {wpx?:number;wch?:number}[]).entries()){if(ci>=COLS||!cw)continue;const px=cw.wpx??(cw.wch?Math.round(cw.wch*7+10):0);if(px>0)widths[ci]=Math.max(40,Math.min(600,Math.round(px)));}
  // A first row of text labels is a header: make it bold and keep it in view while scrolling.
  const top=Object.keys(cells).filter(k=>/^[A-Z]+1$/.test(k));
  const header=top.length>1&&top.every(k=>isNaN(Number(cells[k]))&&!cells[k]!.startsWith('='));
  if(header)for(const k of top)style[k]={...style[k],b:1};
  const pane=(ws as {'!freeze'?:{xSplit?:number;ySplit?:number}})['!freeze'];
  tabs.push({id:`s${i+1}`,name:sn.slice(0,60)||`Sheet${i+1}`,cells,...(rules[sn]?{valid:rules[sn]}:{}),...(Object.keys(style).length?{style}:{}),...(Object.keys(widths).length?{widths}:{}),...(pane&&(pane.ySplit||pane.xSplit)?{freeze:{r:pane.ySplit??0,c:pane.xSplit??0}}:header?{freeze:{r:1,c:0}}:{})});
 }
 if(!tabs.length)tabs.push({id:'s1',name:'Sheet1',cells:{}});
 return {data:{tabs},cut};
}
