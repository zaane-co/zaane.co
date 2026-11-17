// ZARN sheets: the stored shape and a small formula engine (SUM, AVERAGE, IF, …), used by the editor and the read-only link page.
export type Tab={id:string;name:string;cells:Record<string,string>;bold?:Record<string,boolean>;align?:Record<string,'l'|'c'|'r'>;widths?:Record<string,number>};
export type SheetData={tabs:Tab[]};
export const COLS=26,ROWS=200;
export const colName=(c:number)=>String.fromCharCode(65+c);
export const ref=(c:number,r:number)=>`${colName(c)}${r+1}`;
export const parseRef=(s:string):[number,number]|null=>{const m=/^([A-Z])([0-9]{1,4})$/.exec(s.toUpperCase());if(!m)return null;const c=m[1].charCodeAt(0)-65,r=Number(m[2])-1;return c<COLS&&r>=0&&r<ROWS?[c,r]:null;};
export const blankTab=(n=1):Tab=>({id:Math.random().toString(36).slice(2,10),name:`Sheet${n}`,cells:{}});
export function readSheet(raw:string):SheetData{
 try{const d=JSON.parse(raw) as SheetData;if(Array.isArray(d.tabs)&&d.tabs.length)return {tabs:d.tabs.map(t=>({...t,cells:t.cells??{}}))};}catch{}
 return {tabs:[blankTab()]};
}

type V=number|string|boolean|V[];
class Err extends Error{}
const num=(v:V):number=>{if(Array.isArray(v))return num(v[0]??0);if(typeof v==='number')return v;if(typeof v==='boolean')return v?1:0;if(v==='')return 0;const n=Number(v);if(Number.isNaN(n))throw new Err('#VALUE!');return n;};
const flat=(a:V[]):V[]=>a.flatMap(x=>Array.isArray(x)?flat(x):[x]);
const nums=(a:V[])=>flat(a).filter(x=>typeof x==='number'||(typeof x==='string'&&x!==''&&!Number.isNaN(Number(x)))).map(Number);
const text=(v:V):string=>Array.isArray(v)?text(v[0]??''):typeof v==='boolean'?(v?'TRUE':'FALSE'):String(v);
const FN:Record<string,(a:V[])=>V>={
 SUM:a=>nums(a).reduce((x,y)=>x+y,0),
 AVERAGE:a=>{const n=nums(a);if(!n.length)throw new Err('#DIV/0!');return n.reduce((x,y)=>x+y,0)/n.length;},
 MIN:a=>{const n=nums(a);return n.length?Math.min(...n):0;},MAX:a=>{const n=nums(a);return n.length?Math.max(...n):0;},
 COUNT:a=>nums(a).length,COUNTA:a=>flat(a).filter(x=>x!=='').length,
 ROUND:a=>{const p=10**num(a[1]??0);return Math.round(num(a[0])*p)/p;},ABS:a=>Math.abs(num(a[0])),
 IF:a=>{const c=a[0];return (typeof c==='boolean'?c:num(c)!==0)?(a[1]??true):(a[2]??false);},
 AND:a=>flat(a).every(x=>typeof x==='boolean'?x:num(x)!==0),OR:a=>flat(a).some(x=>typeof x==='boolean'?x:num(x)!==0),NOT:a=>!(typeof a[0]==='boolean'?a[0]:num(a[0])!==0),
 CONCAT:a=>flat(a).map(text).join(''),UPPER:a=>text(a[0]).toUpperCase(),LOWER:a=>text(a[0]).toLowerCase(),LEN:a=>text(a[0]).length,
 TODAY:()=>new Date().toISOString().slice(0,10),
};

// Evaluates every cell of a tab. Returns display strings; errors show as #NAME?, #REF!, #CYCLE! and so on.
export function evaluate(tab:Tab):Record<string,string>{
 const out:Record<string,string>={},raw:Record<string,V>={},busy=new Set<string>();
 const cell=(k:string):V=>{
  if(k in raw)return raw[k];
  if(busy.has(k))throw new Err('#CYCLE!');
  const src=tab.cells[k]??'';
  if(!src.startsWith('=')){const n=Number(src);raw[k]=src!==''&&!Number.isNaN(n)&&/^\s*-?[\d.]/.test(src)?n:src;return raw[k];}
  busy.add(k);
  try{raw[k]=formula(src.slice(1),cell);}finally{busy.delete(k);}
  return raw[k];
 };
 for(const k of Object.keys(tab.cells)){
  try{const v=cell(k);out[k]=Array.isArray(v)?text(v):typeof v==='number'?fmt(v):text(v);}
  catch(e){out[k]=e instanceof Err?e.message:'#ERROR!';raw[k]=out[k];}
 }
 return out;
}
const fmt=(n:number)=>Number.isInteger(n)?String(n):String(Math.round(n*1e10)/1e10);

function formula(src:string,cell:(k:string)=>V):V{
 const t=src.match(/"[^"]*"|[A-Za-z]+[0-9]*(?::[A-Za-z]+[0-9]+)?|\d+(?:\.\d+)?|<=|>=|<>|[-+*/^&(),=<>%:]/g)??[];
 let i=0;
 const peek=()=>t[i],next=()=>t[i++];
 const expect=(s:string)=>{if(next()!==s)throw new Err('#ERROR!');};
 function range(a:string,b:string):V[]{const p=parseRef(a),q=parseRef(b);if(!p||!q)throw new Err('#REF!');const res:V[]=[];
  for(let r=Math.min(p[1],q[1]);r<=Math.max(p[1],q[1]);r++)for(let c=Math.min(p[0],q[0]);c<=Math.max(p[0],q[0]);c++)res.push(cell(ref(c,r)));return res;}
 function atom():V{
  const k=next();if(k===undefined)throw new Err('#ERROR!');
  if(k==='('){const v=compare();expect(')');return v;}
  if(k==='-')return -num(atom());if(k==='+')return num(atom());
  if(k.startsWith('"'))return k.slice(1,-1);
  if(/^\d/.test(k))return Number(k);
  const up=k.toUpperCase();
  if(up==='TRUE')return true;if(up==='FALSE')return false;
  if(up.includes(':')){const [a,b]=up.split(':');return range(a,b);}
  if(peek()==='('){next();const f=FN[up];if(!f)throw new Err('#NAME?');const args:V[]=[];
   if(peek()!==')'){do{args.push(compare());}while(peek()===','&&next());}expect(')');return f(args);}
  if(parseRef(up))return cell(up);
  throw new Err('#NAME?');
 }
 function pow():V{let v=atom();while(peek()==='^'){next();v=num(v)**num(atom());}if(peek()==='%'){next();v=num(v)/100;}return v;}
 function mul():V{let v=pow();while(peek()==='*'||peek()==='/'){const o=next(),r=num(pow());if(o==='/'&&r===0)throw new Err('#DIV/0!');v=o==='*'?num(v)*r:num(v)/r;}return v;}
 function add():V{let v=mul();while(peek()==='+'||peek()==='-'){const o=next(),r=num(mul());v=o==='+'?num(v)+r:num(v)-r;}return v;}
 function cat():V{let v=add();while(peek()==='&'){next();v=text(v)+text(add());}return v;}
 function compare():V{let v=cat();while(peek()&&['=','<','>','<=','>=','<>'].includes(peek()!)){const o=next()!,r=cat();
  const [x,y]=typeof v==='number'||typeof r==='number'?[num(v),num(r)]:[text(v),text(r)];
  v=o==='='?x===y:o==='<>'?x!==y:o==='<'?x<y:o==='>'?x>y:o==='<='?x<=y:x>=y;}return v;}
 const v=compare();if(i<t.length)throw new Err('#ERROR!');return v;
}
