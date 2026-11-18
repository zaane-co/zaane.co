// Plain-text paste (what phones and many apps put on the clipboard) loses tables and lists. This rebuilds them:
// tab-separated lines become a table (first row as the header), "•", "-", "*" lines become bullets, "1." lines a numbered list.
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const BULLET=/^\s*[•●◦▪‣\-*]\s+/,NUMBER=/^\s*\d{1,3}[.)]\s+/;
export function plainToHtml(text:string):string|null{
 const lines=text.replace(/\r\n?/g,'\n').split('\n').map(l=>l.replace(/ /g,' ').replace(/\s+$/,''));
 const hasTable=lines.some(l=>l.includes('\t')),hasList=lines.some(l=>BULLET.test(l)||NUMBER.test(l));
 if(!hasTable&&!hasList)return null;
 const out:string[]=[];let i=0;
 while(i<lines.length){
  const l=lines[i]!;
  if(!l.trim()){i++;continue;}
  if(l.includes('\t')){
   const rows:string[][]=[];
   while(i<lines.length&&lines[i]!.includes('\t')){rows.push(lines[i]!.split('\t').map(c=>c.trim()));i++;}
   const cols=Math.max(...rows.map(r=>r.length));
   const row=(r:string[],tag:'th'|'td')=>`<tr>${Array.from({length:cols},(_,k)=>`<${tag}><p>${esc(r[k]??'')}</p></${tag}>`).join('')}</tr>`;
   out.push(`<table><tbody>${row(rows[0]!,'th')}${rows.slice(1).map(r=>row(r,'td')).join('')}</tbody></table>`);
   continue;
  }
  if(BULLET.test(l)||NUMBER.test(l)){
   const num=NUMBER.test(l)&&!BULLET.test(l),re=num?NUMBER:BULLET,items:string[]=[];
   while(i<lines.length&&re.test(lines[i]!)){items.push(`<li><p>${esc(lines[i]!.replace(re,'').trim())}</p></li>`);i++;}
   out.push(num?`<ol>${items.join('')}</ol>`:`<ul>${items.join('')}</ul>`);
   continue;
  }
  out.push(`<p>${esc(l.trim())}</p>`);i++;
 }
 return out.join('');
}
