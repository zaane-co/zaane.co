// ZARN sheets: the stored shape, cell formatting, and a formula engine. Used by the editor and the read-only link page.
export type Style={b?:1;i?:1;u?:1;s?:1;color?:string;bg?:string;h?:'l'|'c'|'r';v?:'t'|'m'|'b';wrap?:1;fmt?:'auto'|'num'|'cur'|'pct'|'date'|'text';cur?:string;dec?:number;size?:number;/** borders, each a CSS border like '1px solid #000' */ bd?:{t?:string;r?:string;b?:string;l?:string}};
// Conditional formatting: a style when a condition holds, or a colour scale across the range.
export type CfCond='empty'|'notEmpty'|'contains'|'notContains'|'startsWith'|'endsWith'|'is'|'gt'|'gte'|'lt'|'lte'|'eq'|'neq'|'between'|'notBetween'|'before'|'after'|'onDate'|'checked'|'formula';
export type CfRule={id:string;range:string;cond:CfCond;a?:string;b?:string;fmt?:{bg?:string;color?:string;b?:1;i?:1;s?:1;u?:1};scale?:{min:string;mid?:string;max:string}};
// Comment threads on cells, and things floating over the grid (charts and pictures). x/y/w/h are pixels at 100% zoom.
export type Cmt={id:string;u:string;t:string;at:string;re?:{u:string;t:string;at:string}[];done?:1};
export type ChartType='column'|'bar'|'line'|'area'|'pie'|'scatter';
export type Obj={id:string;kind:'chart'|'image';x:number;y:number;w:number;h:number;src?:string;range?:string;type?:ChartType;title?:string;head?:1;lab?:1;stack?:1};
// Data validation, like Google Sheets: tick boxes, or a dropdown of options shown as coloured chips.
export type Opt={v:string;c?:string};
export type Rule={id:string;range:string;t:'check'|'list';opts?:Opt[];strict?:1};
export const CHIP_COLORS=['#e8eaed','#c6dafc','#b7e1cd','#fce8b2','#f4c7c3','#e6d4f5','#d2e3fc','#fad2cf','#0b57d0','#188038','#b06000','#c5221f','#8430ce','#e37400','#007b83','#5f6368'];
export const chipInk=(bg?:string)=>{if(!bg)return '#202124';const h=bg.replace('#','');const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);const l=(0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255));return l>150?'#202124':'#fff';};
export const parseRange=(s:string)=>{const [a,b]=s.toUpperCase().replace(/\$/g,'').trim().split(':');const p=parseRef(a??''),q=b?parseRef(b):p;if(!p||!q)return null;return {c0:Math.min(p[0],q[0]),c1:Math.max(p[0],q[0]),r0:Math.min(p[1],q[1]),r1:Math.max(p[1],q[1])};};
export function ruleAt(rules:Rule[]|undefined,c:number,r:number):Rule|undefined{if(!rules)return;for(let i=rules.length-1;i>=0;i--){const b=parseRange(rules[i].range);if(b&&c>=b.c0&&c<=b.c1&&r>=b.r0&&r<=b.r1)return rules[i];}}
export type Tab={id:string;name:string;cells:Record<string,string>;style?:Record<string,Style>;widths?:Record<string,number>;freeze?:{r:number;c:number};color?:string;valid?:Rule[];
 /** filter: the range (header row first) and, per column index, the values hidden */ filter?:{range:string;hide:Record<string,string[]>};hRows?:number[];hCols?:number[];
 /** merged ranges like 'A1:C2' */ merges?:string[];cf?:CfRule[];
 notes?:Record<string,string>;comments?:Record<string,Cmt>;objs?:Obj[];
 /** protected ranges (no range = the whole tab) */ prot?:Prot[];
 /** a pivot table tab: its cells are worked out from the source, not typed */ pivot?:Pivot;
 /** legacy */ bold?:Record<string,boolean>;/** legacy */ align?:Record<string,'l'|'c'|'r'>};
export type SheetData={tabs:Tab[]};
// Protected ranges: only the doc owner, whoever set it up, and the listed editors can change them. warn = anyone can, after a warning.
export type Prot={id:string;range?:string;desc?:string;by:string;eds?:string[];warn?:1};
export const protAt=(prot:Prot[]|undefined,c:number,r:number)=>prot?.find(p=>{if(!p.range)return true;const b=parseRange(p.range);return !!b&&c>=b.c0&&c<=b.c1&&r>=b.r0&&r<=b.r1;});
// Pivot tables: group the source rows by some columns (rows / cols, as indexes inside the range) and summarise others.
export type PivFn='SUM'|'COUNTA'|'COUNT'|'AVERAGE'|'MIN'|'MAX';
export type Pivot={src:string;range:string;rows:number[];cols:number[];vals:{c:number;fn:PivFn}[];noTot?:1};
export const COLS=52,ROWS=1000,COL_W=104,ROW_H=24;
export const colName=(c:number)=>{let s='',n=c+1;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;};
export const colIndex=(s:string)=>{let n=0;for(const ch of s.toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n-1;};
export const ref=(c:number,r:number)=>`${colName(c)}${r+1}`;
export const parseRef=(s:string):[number,number]|null=>{const m=/^\$?([A-Z]{1,2})\$?([0-9]{1,5})$/.exec(s.toUpperCase());if(!m)return null;const c=colIndex(m[1]),r=Number(m[2])-1;return c>=0&&c<COLS&&r>=0&&r<ROWS?[c,r]:null;};
export const blankTab=(n=1):Tab=>({id:Math.random().toString(36).slice(2,10),name:`Sheet${n}`,cells:{}});
export function readSheet(raw:string):SheetData{
 try{const d=JSON.parse(raw) as SheetData;if(Array.isArray(d.tabs)&&d.tabs.length)return {tabs:d.tabs.map(upgrade)};}catch{}
 return {tabs:[blankTab()]};
}
// Older sheets kept bold/alignment in separate maps; fold them into per-cell styles.
function upgrade(t:Tab):Tab{
 const style:Record<string,Style>={...(t.style??{})};
 for(const [k,v] of Object.entries(t.bold??{}))if(v)style[k]={...style[k],b:1};
 for(const [k,v] of Object.entries(t.align??{}))style[k]={...style[k],h:v};
 const rest={...t};delete rest.bold;delete rest.align;
 return {...rest,cells:t.cells??{},style};
}

// ---------- Formulas ----------
type V=number|string|boolean|V[];
class Err extends Error{}
const num=(v:V):number=>{if(Array.isArray(v))return num(v[0]??0);if(typeof v==='number')return v;if(typeof v==='boolean')return v?1:0;if(v==='')return 0;const n=Number(String(v).replace(/,/g,''));if(Number.isNaN(n))throw new Err('#VALUE!');return n;};
const flat=(a:V[]):V[]=>a.flatMap(x=>Array.isArray(x)?flat(x):[x]);
const isNum=(x:V)=>typeof x==='number'||(typeof x==='string'&&x.trim()!==''&&!Number.isNaN(Number(x)));
const nums=(a:V[])=>flat(a).filter(isNum).map(Number);
const text=(v:V):string=>Array.isArray(v)?text(v[0]??''):typeof v==='boolean'?(v?'TRUE':'FALSE'):typeof v==='number'?fmtNum(v):String(v);
const truthy=(v:V):boolean=>typeof v==='boolean'?v:Array.isArray(v)?truthy(v[0]??false):typeof v==='string'?v!==''&&v.toUpperCase()!=='FALSE':v!==0;
// Criteria like ">5", "<>x", "apple" for SUMIF / COUNTIF.
function crit(c:V){const s=text(c),m=/^(<=|>=|<>|<|>|=)?(.*)$/.exec(s)!;const op=m[1]??'=',val=m[2];const n=Number(val),isN=val!==''&&!Number.isNaN(n);
 return (x:V)=>{if(isN&&isNum(x)){const v=Number(x);return op==='='?v===n:op==='<>'?v!==n:op==='<'?v<n:op==='>'?v>n:op==='<='?v<=n:v>=n;}
  const t=text(x).toLowerCase(),w=val.toLowerCase();const re=new RegExp('^'+w.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$');
  return op==='<>'?!re.test(t):op==='='?re.test(t):op==='<'?t<w:op==='>'?t>w:op==='<='?t<=w:t>=w;};}
const toDate=(v:V)=>{if(isNum(v)){const d=new Date(Date.UTC(1899,11,30));d.setUTCDate(d.getUTCDate()+Math.floor(num(v)));return d;}const d=new Date(text(v));if(Number.isNaN(d.getTime()))throw new Err('#VALUE!');return d;};
const serial=(d:Date)=>Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/864e5);
const rows2d=(v:V):V[][]=>Array.isArray(v)&&Array.isArray(v[0])?v as V[][]:Array.isArray(v)?[v as V[]]:[[v]];
export const FUNCTIONS:Record<string,{fn:(a:V[])=>V;help:string}>={
 SUM:{fn:a=>nums(a).reduce((x,y)=>x+y,0),help:'SUM(value1, [value2, …])'},
 AVERAGE:{fn:a=>{const n=nums(a);if(!n.length)throw new Err('#DIV/0!');return n.reduce((x,y)=>x+y,0)/n.length;},help:'AVERAGE(value1, [value2, …])'},
 MIN:{fn:a=>{const n=nums(a);return n.length?Math.min(...n):0;},help:'MIN(value1, [value2, …])'},
 MAX:{fn:a=>{const n=nums(a);return n.length?Math.max(...n):0;},help:'MAX(value1, [value2, …])'},
 MEDIAN:{fn:a=>{const n=nums(a).sort((x,y)=>x-y);if(!n.length)throw new Err('#NUM!');const m=Math.floor(n.length/2);return n.length%2?n[m]:(n[m-1]+n[m])/2;},help:'MEDIAN(value1, [value2, …])'},
 COUNT:{fn:a=>nums(a).length,help:'COUNT(value1, [value2, …])'},
 COUNTA:{fn:a=>flat(a).filter(x=>x!=='').length,help:'COUNTA(value1, [value2, …])'},
 COUNTBLANK:{fn:a=>flat(a).filter(x=>x==='').length,help:'COUNTBLANK(range)'},
 PRODUCT:{fn:a=>nums(a).reduce((x,y)=>x*y,1),help:'PRODUCT(value1, [value2, …])'},
 SUMIF:{fn:a=>{const r=flat([a[0]]),t=crit(a[1]),s=a[2]!==undefined?flat([a[2]]):r;return r.reduce<number>((acc,x,i)=>t(x)&&isNum(s[i]??'')?acc+Number(s[i]):acc,0);},help:'SUMIF(range, criterion, [sum_range])'},
 COUNTIF:{fn:a=>{const t=crit(a[1]);return flat([a[0]]).filter(t).length;},help:'COUNTIF(range, criterion)'},
 AVERAGEIF:{fn:a=>{const r=flat([a[0]]),t=crit(a[1]),s=a[2]!==undefined?flat([a[2]]):r;const v=r.map((x,i)=>t(x)&&isNum(s[i]??'')?Number(s[i]):null).filter((x):x is number=>x!==null);if(!v.length)throw new Err('#DIV/0!');return v.reduce((x,y)=>x+y,0)/v.length;},help:'AVERAGEIF(range, criterion, [average_range])'},
 VLOOKUP:{fn:a=>{const key=a[0],tbl=rows2d(a[1]),col=num(a[2])-1,exact=a[3]===undefined?false:!truthy(a[3]);if(col<0||col>=(tbl[0]?.length??0))throw new Err('#REF!');
  const eq=(x:V)=>isNum(x)&&isNum(key)?Number(x)===Number(key):text(x).toLowerCase()===text(key).toLowerCase();
  if(exact||!isNum(key)){const row=tbl.find(r=>eq(r[0]));if(!row)throw new Err('#N/A');return row[col];}
  let best:V[]|null=null;for(const r of tbl){if(isNum(r[0])&&Number(r[0])<=Number(key))best=r;else if(isNum(r[0]))break;}if(!best)throw new Err('#N/A');return best[col];},help:'VLOOKUP(search_key, range, index, [is_sorted])'},
 HLOOKUP:{fn:a=>{const tbl=rows2d(a[1]),row=num(a[2])-1;const i=(tbl[0]??[]).findIndex(x=>text(x).toLowerCase()===text(a[0]).toLowerCase());if(i<0)throw new Err('#N/A');if(!tbl[row])throw new Err('#REF!');return tbl[row][i];},help:'HLOOKUP(search_key, range, index, [is_sorted])'},
 INDEX:{fn:a=>{const t=rows2d(a[0]),r=num(a[1]??1)-1,c=num(a[2]??1)-1;const v=t[r]?.[c];if(v===undefined)throw new Err('#REF!');return v;},help:'INDEX(reference, row, [column])'},
 MATCH:{fn:a=>{const i=flat([a[1]]).findIndex(x=>text(x).toLowerCase()===text(a[0]).toLowerCase());if(i<0)throw new Err('#N/A');return i+1;},help:'MATCH(search_key, range, [search_type])'},
 IF:{fn:a=>truthy(a[0])?(a[1]??true):(a[2]??false),help:'IF(condition, value_if_true, value_if_false)'},
 IFERROR:{fn:a=>a[0],help:'IFERROR(value, value_if_error)'},
 AND:{fn:a=>flat(a).every(truthy),help:'AND(logical1, [logical2, …])'},
 OR:{fn:a=>flat(a).some(truthy),help:'OR(logical1, [logical2, …])'},
 NOT:{fn:a=>!truthy(a[0]),help:'NOT(logical)'},
 ROUND:{fn:a=>{const p=10**num(a[1]??0);return Math.round(num(a[0])*p)/p;},help:'ROUND(value, [places])'},
 ROUNDUP:{fn:a=>{const p=10**num(a[1]??0);return Math.ceil(num(a[0])*p)/p;},help:'ROUNDUP(value, [places])'},
 ROUNDDOWN:{fn:a=>{const p=10**num(a[1]??0);return Math.floor(num(a[0])*p)/p;},help:'ROUNDDOWN(value, [places])'},
 INT:{fn:a=>Math.floor(num(a[0])),help:'INT(value)'},
 ABS:{fn:a=>Math.abs(num(a[0])),help:'ABS(value)'},
 SQRT:{fn:a=>{const n=num(a[0]);if(n<0)throw new Err('#NUM!');return Math.sqrt(n);},help:'SQRT(value)'},
 POWER:{fn:a=>num(a[0])**num(a[1]),help:'POWER(base, exponent)'},
 MOD:{fn:a=>{const d=num(a[1]);if(!d)throw new Err('#DIV/0!');const n=num(a[0]);return n-d*Math.floor(n/d);},help:'MOD(dividend, divisor)'},
 RAND:{fn:()=>Math.random(),help:'RAND()'},
 CONCAT:{fn:a=>flat(a).map(text).join(''),help:'CONCAT(value1, value2)'},
 CONCATENATE:{fn:a=>flat(a).map(text).join(''),help:'CONCATENATE(string1, [string2, …])'},
 TEXTJOIN:{fn:a=>{const sep=text(a[0]),skip=truthy(a[1]);return flat(a.slice(2)).map(text).filter(x=>!skip||x!=='').join(sep);},help:'TEXTJOIN(delimiter, ignore_empty, text1, …)'},
 UPPER:{fn:a=>text(a[0]).toUpperCase(),help:'UPPER(text)'},LOWER:{fn:a=>text(a[0]).toLowerCase(),help:'LOWER(text)'},
 PROPER:{fn:a=>text(a[0]).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()),help:'PROPER(text)'},
 LEN:{fn:a=>text(a[0]).length,help:'LEN(text)'},TRIM:{fn:a=>text(a[0]).replace(/\s+/g,' ').trim(),help:'TRIM(text)'},
 LEFT:{fn:a=>text(a[0]).slice(0,num(a[1]??1)),help:'LEFT(string, [number_of_characters])'},
 RIGHT:{fn:a=>{const s=text(a[0]),n=num(a[1]??1);return n?s.slice(-n):'';},help:'RIGHT(string, [number_of_characters])'},
 MID:{fn:a=>text(a[0]).substr(num(a[1])-1,num(a[2])),help:'MID(string, starting_at, extract_length)'},
 SUBSTITUTE:{fn:a=>text(a[0]).split(text(a[1])).join(text(a[2])),help:'SUBSTITUTE(text, search_for, replace_with)'},
 FIND:{fn:a=>{const i=text(a[1]).indexOf(text(a[0]));if(i<0)throw new Err('#VALUE!');return i+1;},help:'FIND(search_for, text_to_search)'},
 TODAY:{fn:()=>serial(new Date()),help:'TODAY()'},
 HYPERLINK:{fn:a=>text(a[1]??a[0]??''),help:'HYPERLINK(url, [link_label])'},
 IMAGE:{fn:a=>text(a[0]??''),help:'IMAGE(url)'},
 NOW:{fn:()=>{const d=new Date();return serial(d)+(d.getHours()*3600+d.getMinutes()*60+d.getSeconds())/86400;},help:'NOW()'},
 DATE:{fn:a=>serial(new Date(num(a[0]),num(a[1])-1,num(a[2]))),help:'DATE(year, month, day)'},
 YEAR:{fn:a=>toDate(a[0]).getUTCFullYear(),help:'YEAR(date)'},MONTH:{fn:a=>toDate(a[0]).getUTCMonth()+1,help:'MONTH(date)'},DAY:{fn:a=>toDate(a[0]).getUTCDate(),help:'DAY(date)'},
 DAYS:{fn:a=>Math.round((toDate(a[0]).getTime()-toDate(a[1]).getTime())/864e5),help:'DAYS(end_date, start_date)'},
 ISBLANK:{fn:a=>text(a[0])==='',help:'ISBLANK(value)'},ISNUMBER:{fn:a=>isNum(a[0])&&typeof a[0]!=='boolean',help:'ISNUMBER(value)'},
};
export const FUNCTION_NAMES=Object.keys(FUNCTIONS).sort();

// Evaluates every cell of a tab (other tabs can be referenced as Sheet2!A1 or 'My tab'!A1:B4).
// Returns raw values; display strings come from show().
export function evaluate(tab:Tab,tabs:Tab[]=[tab]):Record<string,V>{
 const cache=new Map<string,V>(),busy=new Set<string>();
 const byName=(n:string)=>tabs.find(t=>t.name.toLowerCase()===n.toLowerCase());
 const cell=(t:Tab,k:string):V=>{
  const key=`${t.id}!${k}`;if(cache.has(key))return cache.get(key)!;
  if(busy.has(key))throw new Err('#CYCLE!');
  const src=t.cells[k]??'';let v:V;
  if(/^(true|false)$/i.test(src))v=src.toUpperCase()==='TRUE';
  else if(!src.startsWith('=')||src.length<2){v=src!==''&&/^\s*-?[\d,]*\.?\d+(e[-+]?\d+)?\s*%?\s*$/i.test(src)?(src.trim().endsWith('%')?Number(src.replace(/[%,\s]/g,''))/100:Number(src.replace(/[,\s]/g,''))):src;}
  else{busy.add(key);try{v=formula(src.slice(1),(tn,k2)=>{const tt=tn?byName(tn):t;if(!tt)throw new Err('#REF!');return cell(tt,k2);});}catch(e){v=e instanceof Err?e.message:'#ERROR!';}finally{busy.delete(key);}}
  cache.set(key,v);return v;
 };
 const out:Record<string,V>={};
 for(const k of Object.keys(tab.cells))out[k]=cell(tab,k);
 return out;
}
const fmtNum=(n:number)=>Number.isInteger(n)?String(n):String(Math.round(n*1e10)/1e10);
export const isError=(v:unknown)=>typeof v==='string'&&/^#(CYCLE!|REF!|NAME\?|VALUE!|DIV\/0!|N\/A|NUM!|ERROR!)$/.test(v);
// What a cell shows, given its value and formatting.
export function show(v:V|undefined,st?:Style):string{
 if(v===undefined||v==='')return '';
 if(Array.isArray(v))return show(v[0],st);
 if(typeof v==='boolean')return v?'TRUE':'FALSE';
 if(typeof v==='string')return v;
 const f=st?.fmt??'auto',d=st?.dec;
 const grouped=(n:number,dd:number)=>n.toLocaleString('en-US',{minimumFractionDigits:dd,maximumFractionDigits:dd});
 if(f==='pct')return `${grouped(v*100,d??2)}%`;
 if(f==='cur')return `${v<0?'-':''}${st?.cur??'₦'}${grouped(Math.abs(v),d??2)}`;
 if(f==='num')return grouped(v,d??2);
 if(f==='date'){const dt=toDate(v);return `${dt.getUTCDate()} ${dt.toLocaleString('en-GB',{month:'short',timeZone:'UTC'})} ${dt.getUTCFullYear()}`;}
 return d!==undefined?grouped(v,d):fmtNum(v);
}

function formula(src:string,cell:(tab:string|null,k:string)=>V):V{
 const t=src.match(/"(?:[^"]|"")*"|'[^']+'!\$?[A-Za-z]{1,2}\$?\d+(?::\$?[A-Za-z]{1,2}\$?\d+)?|[A-Za-z_][\w.]*!\$?[A-Za-z]{1,2}\$?\d+(?::\$?[A-Za-z]{1,2}\$?\d+)?|\$?[A-Za-z]{1,2}\$?\d+:\$?[A-Za-z]{1,2}\$?\d+|[A-Za-z_][A-Za-z0-9_.]*|\$?[A-Za-z]{1,2}\$?\d+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|<=|>=|<>|[-+*/^&(),=<>%;]/g)??[];
 let i=0;
 const peek=()=>t[i],next=()=>t[i++];
 const expect=(s:string)=>{if(next()!==s)throw new Err('#ERROR!');};
 const split=(tok:string):[string|null,string]=>{const bang=tok.lastIndexOf('!');if(bang<0)return [null,tok];let n=tok.slice(0,bang);if(n.startsWith("'"))n=n.slice(1,-1);return [n,tok.slice(bang+1)];};
 function range(tab:string|null,a:string,b:string):V[][]{const p=parseRef(a),q=parseRef(b);if(!p||!q)throw new Err('#REF!');const res:V[][]=[];
  for(let r=Math.min(p[1],q[1]);r<=Math.max(p[1],q[1]);r++){const row:V[]=[];for(let c=Math.min(p[0],q[0]);c<=Math.max(p[0],q[0]);c++){const v=cell(tab,ref(c,r));if(isError(v))throw new Err(v as string);row.push(v);}res.push(row);}return res;}
 function atom():V{
  const k=next();if(k===undefined)throw new Err('#ERROR!');
  if(k==='('){const v=compare();expect(')');return v;}
  if(k==='-')return -num(pow());if(k==='+')return num(pow());
  if(k.startsWith('"'))return k.slice(1,-1).replace(/""/g,'"');
  if(/^\d/.test(k))return Number(k);
  const [tab,body]=split(k),up=body.toUpperCase();
  if(!tab&&up==='TRUE')return true;if(!tab&&up==='FALSE')return false;
  if(up.includes(':')){const [a,b]=up.split(':');return range(tab,a,b) as V;}
  if(!tab&&peek()==='('){next();const f=FUNCTIONS[up];if(!f)throw new Err('#NAME?');const args:V[]=[];
   if(up==='IFERROR'){const save=i;try{const v=compare();if(isError(v))throw new Err(v as string);args.push(v);}catch{i=save;skipArg();args.push('__err');}
    if(peek()===','||peek()===';'){next();const alt=compare();if(args[0]==='__err'){if(peek()!==')')throw new Err('#ERROR!');next();return alt;}}expect(')');return args[0]==='__err'?'':args[0];}
   if(peek()!==')'){do{args.push(compare());}while((peek()===','||peek()===';')&&next());}expect(')');return f.fn(args);}
  if(parseRef(up)){const v=cell(tab,up.replace(/\$/g,''));if(isError(v))throw new Err(v as string);return v;}
  throw new Err('#NAME?');
 }
 // Skip one argument's tokens (used when IFERROR's first argument fails).
 function skipArg(){let depth=0;while(i<t.length){const k=t[i];if(depth===0&&(k===','||k===';'||k===')'))return;if(k==='(')depth++;if(k===')')depth--;i++;}}
 function pow():V{let v=atom();while(peek()==='^'){next();v=num(v)**num(atom());}while(peek()==='%'){next();v=num(v)/100;}return v;}
 function mul():V{let v=pow();while(peek()==='*'||peek()==='/'){const o=next(),r=num(pow());if(o==='/'&&r===0)throw new Err('#DIV/0!');v=o==='*'?num(v)*r:num(v)/r;}return v;}
 function add():V{let v=mul();while(peek()==='+'||peek()==='-'){const o=next(),r=num(mul());v=o==='+'?num(v)+r:num(v)-r;}return v;}
 function cat():V{let v=add();while(peek()==='&'){next();v=text(v)+text(add());}return v;}
 function compare():V{let v=cat();while(peek()&&['=','<','>','<=','>=','<>'].includes(peek()!)){const o=next()!,r=cat();
  const [x,y]=isNum(v)&&isNum(r)?[num(v),num(r)]:[text(v).toLowerCase(),text(r).toLowerCase()];
  v=o==='='?x===y:o==='<>'?x!==y:o==='<'?x<y:o==='>'?x>y:o==='<='?x<=y:x>=y;}return v;}
 const v=compare();if(i<t.length)throw new Err('#ERROR!');return v;
}

// ---------- Moving formulas around ----------
// Copy/paste and fill: shift relative references by (dc, dr); $-anchored parts stay put.
export function shiftRefs(src:string,dc:number,dr:number){
 if(!src.startsWith('='))return src;
 return src.replace(/"(?:[^"]|"")*"|('[^']+'!|[A-Za-z_][\w.]*!)?(\$?)([A-Z]{1,2})(\$?)(\d+)(?![\w(])/g,(m,tab,ac,col,ar,row)=>{
  if(m.startsWith('"'))return m;
  const c=ac?colIndex(col):colIndex(col)+dc,r=ar?Number(row):Number(row)+dr;
  if(c<0||r<1)return '#REF!';
  return `${tab??''}${ac}${colName(c)}${ar}${r}`;
 });
}
// Inserting or deleting rows/columns: move every reference that sits at or after the change.
export function adjustRefs(src:string,axis:'r'|'c',at:number,delta:number){
 if(!src.startsWith('='))return src;
 return src.replace(/"(?:[^"]|"")*"|('[^']+'!|[A-Za-z_][\w.]*!)?(\$?)([A-Z]{1,2})(\$?)(\d+)(?![\w(])/g,(m,tab,ac,col,ar,row)=>{
  if(m.startsWith('"')||tab)return m;
  let c=colIndex(col),r=Number(row)-1;
  if(axis==='r'){if(delta<0&&r>=at&&r<at-delta)return '#REF!';if(r>=at)r+=delta;}
  else{if(delta<0&&c>=at&&c<at-delta)return '#REF!';if(c>=at)c+=delta;}
  return `${tab??''}${ac}${colName(c)}${ar}${r+1}`;
 });
}

// Works out a one-off formula against a tab (conditional formatting's custom formulas use it).
export function exprEval(tab:Tab,tabs:Tab[]=[tab]){
 const cache=new Map<string,V>(),busy=new Set<string>();
 const byName=(n:string)=>tabs.find(t=>t.name.toLowerCase()===n.toLowerCase());
 const cell=(t:Tab,k:string):V=>{const key=`${t.id}!${k}`;if(cache.has(key))return cache.get(key)!;if(busy.has(key))throw new Err('#CYCLE!');
  const src=t.cells[k]??'';let v:V;
  if(/^(true|false)$/i.test(src))v=src.toUpperCase()==='TRUE';
  else if(!src.startsWith('=')||src.length<2){v=src!==''&&/^\s*-?[\d,]*\.?\d+(e[-+]?\d+)?\s*%?\s*$/i.test(src)?(src.trim().endsWith('%')?Number(src.replace(/[%,\s]/g,''))/100:Number(src.replace(/[,\s]/g,''))):src;}
  else{busy.add(key);try{v=formula(src.slice(1),(tn,k2)=>{const tt=tn?byName(tn):t;if(!tt)throw new Err('#REF!');return cell(tt,k2);});}catch(e){v=e instanceof Err?e.message:'#ERROR!';}finally{busy.delete(key);}}
  cache.set(key,v);return v;};
 return (src:string):V=>{try{return formula(src.replace(/^=/,''),(tn,k2)=>{const tt=tn?byName(tn):tab;if(!tt)throw new Err('#REF!');return cell(tt,k2);});}catch(e){return e instanceof Err?e.message:'#ERROR!';}};
}
// Dates as sheet serial numbers (days since 30 Dec 1899), the same as Google Sheets and Excel.
export const dateToSerial=(y:number,m:number,d:number)=>Math.round((Date.UTC(y,m,d)-Date.UTC(1899,11,30))/864e5);
export const serialToDate=(n:number)=>{const d=new Date(Date.UTC(1899,11,30));d.setUTCDate(d.getUTCDate()+Math.floor(n));return d;};
// Reads typed dates like 18/11/2026, 2026-11-18, 18 Nov 2026 or Nov 18, 2026 (day first for slashes).
export function parseDateText(s:string):number|null{const t=s.trim();if(!t||/^-?\d+(\.\d+)?$/.test(t))return null;
 let m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);if(m)return dateToSerial(+m[1],+m[2]-1,+m[3]);
 m=/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);if(m){const y=+m[3]<100?2000+ +m[3]:+m[3];return dateToSerial(y,+m[2]-1,+m[1]);}
 const d=new Date(/\d{4}/.test(t)?t:`${t} ${new Date().getFullYear()}`);return Number.isNaN(d.getTime())?null:dateToSerial(d.getFullYear(),d.getMonth(),d.getDate());}
// The link a cell points to: a HYPERLINK formula, or text that is a web address.
export function linkOf(raw:string|undefined,shown:string):string|null{
 const m=raw?/^=HYPERLINK\(\s*"([^"]+)"/i.exec(raw):null;const u=m?m[1]:/^(https?:\/\/|www\.)\S+$/i.test(shown.trim())?shown.trim():null;
 if(!u)return null;const full=/^https?:\/\//i.test(u)?u:`https://${u}`;try{const x=new URL(full);return x.protocol==='http:'||x.protocol==='https:'?x.href:null;}catch{return null;}}

// Works a pivot table out into plain cells (and bold headers / totals) for the pivot tab.
export function runPivot(p:Pivot,tabs:Tab[]):{cells:Record<string,string>;style:Record<string,Style>;head:string[]}{
 const src=tabs.find(t=>t.id===p.src),b=parseRange(p.range);
 if(!src||!b)return {cells:{A1:'The source data for this pivot table is missing.'},style:{},head:[]};
 const vals=evaluate(src,tabs),at=(c:number,r:number)=>vals[ref(b.c0+c,r)]??'';
 const head=Array.from({length:b.c1-b.c0+1},(_,i)=>text(at(i,b.r0)).trim()||`Column ${colName(b.c0+i)}`);
 let last=b.r0;for(const k of Object.keys(src.cells)){const q=parseRef(k);if(q&&q[0]>=b.c0&&q[0]<=b.c1&&q[1]<=b.r1)last=Math.max(last,q[1]);}
 const rows:V[][]=[];for(let r=b.r0+1;r<=last;r++){const row=head.map((_,i)=>at(i,r));if(row.some(x=>x!==''))rows.push(row);}
 const keyOf=(row:V[],idx:number[])=>idx.map(i=>text(row[i]??'')).join('\u0001');
 const bag=new Map<string,V[][]>();const put=(k:string,row:V[])=>{let a=bag.get(k);if(!a)bag.set(k,a=[]);a.push(row);};
 const rk=new Set<string>(),ck=new Set<string>();
 for(const row of rows){const r2=keyOf(row,p.rows),c2=keyOf(row,p.cols);rk.add(r2);ck.add(c2);put(`${r2}\u0002${c2}`,row);put(`${r2}\u0002*`,row);put(`*\u0002${c2}`,row);put('*\u0002*',row);}
 const cmp=(x:string,y:string)=>{const a=x.split('\u0001'),z=y.split('\u0001');for(let i=0;i<a.length;i++){const n=a[i].localeCompare(z[i]??'',undefined,{numeric:true});if(n)return n;}return 0;};
 const RK=p.rows.length?[...rk].sort(cmp):[],CK=p.cols.length?[...ck].sort(cmp):[];
 const agg=(set:V[][]|undefined,v:{c:number;fn:PivFn}):number|''=>{const xs=(set??[]).map(r=>r[v.c]??'');if(!set?.length)return '';
  if(v.fn==='COUNTA')return xs.filter(x=>x!=='').length;const ns=xs.filter(isNum).map(Number);
  if(v.fn==='COUNT')return ns.length;if(v.fn==='SUM')return ns.reduce((a,c)=>a+c,0);if(!ns.length)return '';
  return v.fn==='AVERAGE'?ns.reduce((a,c)=>a+c,0)/ns.length:v.fn==='MIN'?Math.min(...ns):Math.max(...ns);};
 const label=(v:{c:number;fn:PivFn})=>`${v.fn} of ${head[v.c]??'?'}`;
 const cells:Record<string,string>={},style:Record<string,Style>={};
 const set=(c:number,r:number,v:V|'',bold=false)=>{if(c>=COLS||r>=ROWS)return;const k=ref(c,r);let s=text(v);if(s.startsWith('='))s=` ${s}`;if(s!=='')cells[k]=s;if(bold)style[k]={b:1};};
 const L=Math.max(p.rows.length,1),V2=p.vals.length?p.vals:[],tot=!p.noTot;
 const blocks=[...CK.map(c=>c),...(CK.length&&tot?['*']:[])];if(!CK.length)blocks.push('*');
 const hr=CK.length?2:1;
 // Header rows
 p.rows.forEach((ri,i)=>set(i,hr-1,head[ri]??'',true));
 if(CK.length){set(0,0,p.cols.map(i=>head[i]).join(' / '),true);
  blocks.forEach((ckey,bi)=>{const x=L+bi*Math.max(V2.length,1);set(x,0,ckey==='*'?'Grand total':ckey.split('\u0001').join(' / '),true);V2.forEach((v,vi)=>set(x+vi,1,label(v),true));});}
 else V2.forEach((v,vi)=>set(L+vi,0,label(v),true));
 // Body
 let r=hr;const prev:string[]=[];
 for(const key of RK){const parts=key.split('\u0001');let same=true;parts.forEach((pt,i)=>{same=same&&prev[i]===pt;if(!same)set(i,r,pt===''?'(blank)':pt);});prev.splice(0,prev.length,...parts);
  blocks.forEach((ckey,bi)=>V2.forEach((v,vi)=>set(L+bi*V2.length+vi,r,agg(bag.get(`${key}\u0002${ckey}`),v))));r++;}
 if(tot||!RK.length){set(0,r,'Grand total',true);blocks.forEach((ckey,bi)=>V2.forEach((v,vi)=>set(L+bi*V2.length+vi,r,agg(bag.get(`*\u0002${ckey}`),v),true)));}
 return {cells,style,head};
}
