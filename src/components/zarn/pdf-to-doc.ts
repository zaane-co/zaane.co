// Turns a PDF's text into document HTML: bigger or bold lines become headings, close lines join into paragraphs,
// widely spaced columns become tables (wrapped cell text rejoins its cell), and bullets / numbers become lists.
// Repeated page headers and footers are dropped. Scanned PDFs (pictures only) have no text to edit.
type Seg={x:number;text:string};
type Line={y:number;x:number;size:number;bold:boolean;segs:Seg[];text:string;page:number};
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const BULLET=/^\s*[•●◦▪‣\-*]\s+/,NUMBER=/^\s*\d{1,3}[.)]\s+/;
export async function pdfToHtml(data:ArrayBuffer):Promise<string>{
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
 const pdf=await pdfjs.getDocument({data:new Uint8Array(data)}).promise;
 const lines:Line[]=[];
 for(let p=1;p<=pdf.numPages;p++){
  const page=await pdf.getPage(p),tc=await page.getTextContent();
  const styles=tc.styles as Record<string,{fontFamily?:string}>;
  type It={str:string;x:number;y:number;w:number;size:number;bold:boolean};
  const items:It[]=[];
  for(const raw of tc.items as {str?:string;transform?:number[];width?:number;fontName?:string}[]){
   if(!raw.str||!raw.transform)continue;
   const t=raw.transform,size=Math.round(Math.hypot(t[2]!,t[3]!)*10)/10||10;
   const fam=`${raw.fontName??''} ${styles[raw.fontName??'']?.fontFamily??''}`;
   items.push({str:raw.str,x:t[4]!,y:t[5]!,w:raw.width??0,size,bold:/bold|black|heavy|semibold/i.test(fam)});
  }
  items.sort((a,b)=>b.y-a.y||a.x-b.x);
  let row:It[]=[];
  const flush=()=>{if(!row.length)return;row.sort((a,b)=>a.x-b.x);
   const size=Math.max(...row.map(i=>i.size)),segs:Seg[]=[];let end=-1e9;
   for(const it of row){if(!it.str.trim())continue;const gap=it.x-end,cur=segs[segs.length-1];
    if(!cur||gap>size*.8)segs.push({x:it.x,text:it.str});
    else cur.text+=(gap>size*.12&&!/\s$/.test(cur.text)&&!/^\s/.test(it.str)?' ':'')+it.str;
    end=it.x+it.w;}
   const clean=segs.map(s=>({x:s.x,text:s.text.replace(/[  ]+/g,' ').trim()})).filter(s=>s.text);
   // A bullet or number set apart from its text belongs to that text, not to a column of its own.
   for(let k=0;k<clean.length-1;k++)if(/^([•●◦▪‣\-*]|\d{1,3}[.)])$/.test(clean[k]!.text)){clean[k]={x:clean[k]!.x,text:`${clean[k]!.text} ${clean[k+1]!.text}`};clean.splice(k+1,1);}
   if(clean.length)lines.push({y:row[0]!.y,x:clean[0]!.x,size,bold:row.every(i=>i.bold||!i.str.trim()),segs:clean,text:clean.map(s=>s.text).join('\t'),page:p});row=[];};
  for(const it of items){if(row.length&&Math.abs(row[0]!.y-it.y)>Math.max(2,it.size*.4))flush();row.push(it);}
  flush();
 }
 if(!lines.length)throw new Error('This PDF has no text to edit. It may be a scan or a picture.');
 // Drop page numbers and lines repeated on several pages (running headers / footers).
 const key=(t:string)=>t.replace(/\d+/g,'#').toLowerCase();
 const seen=new Map<string,Set<number>>();for(const l of lines){const k=key(l.text);if(!seen.has(k))seen.set(k,new Set());seen.get(k)!.add(l.page);}
 const kept=lines.filter(l=>!(/^(page\s*)?#(\s*(of|\/)\s*#)?$/i.test(key(l.text))||(pdf.numPages>=3&&l.text.length<90&&seen.get(key(l.text))!.size>=Math.min(3,pdf.numPages))));
 const tally=new Map<number,number>();for(const l of kept)tally.set(l.size,(tally.get(l.size)??0)+l.text.length);
 const body=[...tally.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??10;
 const out:string[]=[];
 let para='',list:{num:boolean;items:string[];x:number}|null=null,table:{cols:number[];rows:string[][]}|null=null,prev:Line|null=null;
 const endPara=()=>{if(para){out.push(`<p>${esc(para)}</p>`);para='';}};
 const endList=()=>{if(list){const t=list.num?'ol':'ul';out.push(`<${t}>${list.items.map(i=>`<li><p>${esc(i)}</p></li>`).join('')}</${t}>`);list=null;}};
 const endTable=()=>{if(table){const n=table.cols.length;const r=(cells:string[],tag:string)=>`<tr>${Array.from({length:n},(_,k)=>`<${tag}><p>${esc((cells[k]??'').trim())}</p></${tag}>`).join('')}</tr>`;
  out.push(`<table><tbody>${r(table.rows[0]!,'th')}${table.rows.slice(1).map(x=>r(x,'td')).join('')}</tbody></table>`);table=null;}};
 const endAll=()=>{endPara();endList();endTable();};
 const col=(x:number,cols:number[])=>{let best=0;cols.forEach((c,i)=>{if(Math.abs(c-x)<Math.abs(cols[best]!-x))best=i;});return best;};
 for(const l of kept){
  const tight=!!prev&&prev.page===l.page&&prev.y-l.y<=l.size*1.6;
  const wrap=!!prev&&prev.page===l.page&&prev.y-l.y<=l.size*1.45;
  if(table&&wrap){const last=table.rows[table.rows.length-1]!;for(const s of l.segs){const k=col(s.x,table.cols);last[k]=last[k]?`${last[k]} ${s.text}`:s.text;}prev=l;continue;}
  if(l.segs.length>1){
   if(!table){endPara();endList();table={cols:l.segs.map(s=>s.x),rows:[]};}
   const cells:string[]=[];for(const s of l.segs){const k=col(s.x,table.cols);cells[k]=cells[k]?`${cells[k]} ${s.text}`:s.text;}
   table.rows.push(cells);prev=l;continue;
  }
  endTable();
  const ratio=l.size/body,short=l.text.length<90&&!/[.,;:]$/.test(l.text),isItem=BULLET.test(l.text)||NUMBER.test(l.text);
  const tag=ratio>=1.5?'h1':ratio>=1.2?'h2':(l.bold&&short&&ratio>=.95&&!isItem)?'h3':null;
  if(tag){endAll();out.push(`<${tag}>${esc(l.text)}</${tag}>`);prev=null;continue;}
  if(isItem){endPara();const num=NUMBER.test(l.text)&&!BULLET.test(l.text);if(list&&list.num!==num)endList();
   if(!list)list={num,items:[],x:l.x};list.items.push(l.text.replace(num?NUMBER:BULLET,'').trim());prev=l;continue;}
  if(list&&tight&&l.x>list.x+1){list.items[list.items.length-1]+=` ${l.text}`;prev=l;continue;}
  endList();
  if(para&&tight)para=para.endsWith('-')?para.slice(0,-1)+l.text:`${para} ${l.text}`;
  else{endPara();para=l.text;}
  prev=l;
 }
 endAll();
 return out.join('');
}
