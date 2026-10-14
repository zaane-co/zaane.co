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
