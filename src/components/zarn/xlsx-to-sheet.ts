// Reads an Excel / CSV / ODS file into a ZARN sheet: every tab, values and formulas, fill colours, column widths and
// frozen header rows. Empty pre-formatted cells are skipped, and anything past ZARN's grid size is left out.
import {COLS,ROWS,colIndex,type SheetData,type Style,type Tab} from '@/lib/sheet';
export async function fileToSheet(buf:ArrayBuffer,name:string):Promise<{data:SheetData;cut:boolean}>{
 const X=await import('xlsx');
 const csv=/\.(csv|tsv|txt)$/i.test(name);
 const wb=csv?X.read(new TextDecoder().decode(buf),{type:'string',raw:false}):X.read(new Uint8Array(buf),{type:'array',cellStyles:true,cellFormula:true,dense:false});
 let cut=false;const tabs:Tab[]=[];
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
  tabs.push({id:`s${i+1}`,name:sn.slice(0,60)||`Sheet${i+1}`,cells,...(Object.keys(style).length?{style}:{}),...(Object.keys(widths).length?{widths}:{}),...(pane&&(pane.ySplit||pane.xSplit)?{freeze:{r:pane.ySplit??0,c:pane.xSplit??0}}:header?{freeze:{r:1,c:0}}:{})});
 }
 if(!tabs.length)tabs.push({id:'s1',name:'Sheet1',cells:{}});
 return {data:{tabs},cut};
}
