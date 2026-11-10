// Z-BOT's face: a clean ZARN-red tile with two eyes and a smile.
export default function ZBotMark({size=40}:{size?:number}){
 return <svg className="zbot-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden>
  <rect width="48" height="48" rx="14" fill="#f10c45"/>
  <ellipse cx="17.5" cy="21" rx="3.2" ry="4" fill="#fff"/><ellipse cx="30.5" cy="21" rx="3.2" ry="4" fill="#fff"/>
  <path d="M18 30q6 4.5 12 0" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"/>
 </svg>;
}
