import 'server-only';
import sanitize from 'sanitize-html';
import {marked} from 'marked';
const align={'text-align':[/^(left|right|center|justify)$/]};
// Allow exactly what the TipTap editor produces, nothing else.
export function cleanHtml(html:string){return sanitize(html,{
 allowedTags:['p','br','h1','h2','h3','strong','b','em','i','u','s','a','ul','ol','li','blockquote','pre','code','img','span','hr'],
 allowedAttributes:{a:['href','target','rel'],img:['src','alt','width'],span:['style'],p:['style'],h1:['style'],h2:['style'],h3:['style']},
 allowedStyles:{span:{color:[/^#[0-9a-f]{3,8}$/i,/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/]},p:align,h1:align,h2:align,h3:align},
 allowedSchemes:['http','https','mailto'],
 transformTags:{a:sanitize.simpleTransform('a',{rel:'noopener noreferrer'})},
});}
export const isHtml=(s:string)=>/^\s*</.test(s);
// Posts written before the rich editor are markdown; render them to HTML for the editor and the site.
export function postHtml(content:string){return cleanHtml(isHtml(content)?content:marked.parse(content,{async:false}));}
// ZARN docs: everything the docs editor makes (fonts, sizes, colours, highlights, spacing, indents, checklists, tables).
const colour=[/^#[0-9a-f]{3,8}$/i,/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/];
const block={'text-align':[/^(left|right|center|justify)$/],'line-height':[/^[\d.]{1,4}$/],'margin-left':[/^\d{1,3}px$/]};
export function cleanDocHtml(html:string){return sanitize(html,{
 allowedTags:['p','br','h1','h2','h3','strong','b','em','i','u','s','a','ul','ol','li','blockquote','pre','code','img','span','hr','mark','label','input','div','table','thead','tbody','tr','th','td','colgroup','col'],
 allowedAttributes:{a:['href','target','rel'],img:['src','alt','width'],span:['style'],mark:['style'],p:['style'],h1:['style'],h2:['style'],h3:['style'],ul:['data-type'],li:['data-type','data-checked'],input:['type','checked','disabled'],td:['colspan','rowspan','colwidth'],th:['colspan','rowspan','colwidth'],col:['style'],table:['style']},
 allowedStyles:{span:{color:colour,'background-color':colour,'font-size':[/^\d{1,3}(\.\d)?(pt|px)$/],'font-family':[/^[\w\s"',-]{1,80}$/]},mark:{'background-color':colour},p:block,h1:block,h2:block,h3:block,col:{width:[/^\d{1,4}px$/]},table:{width:[/^\d{1,4}px$/],'min-width':[/^\d{1,4}px$/]}},
 allowedSchemes:['http','https','mailto'],
 transformTags:{a:sanitize.simpleTransform('a',{rel:'noopener noreferrer'}),input:(t,a)=>({tagName:'input',attribs:{type:'checkbox',disabled:'',...(a.checked!==undefined?{checked:''}:{})}})},
});}
