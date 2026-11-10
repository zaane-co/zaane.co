// Z-BOT's face: a ZARN-red tile with friendly eyes and a smile.
export default function ZBotMark({size=40}:{size?:number}){
 return <svg className="zbot-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden>
  <defs><linearGradient id="zbot-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff3d6e"/><stop offset="1" stopColor="#c8073a"/></linearGradient></defs>
  <rect width="48" height="48" rx="13" fill="url(#zbot-g)"/>
  <path d="M13 15.5h22l-22 17h22" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx="17" cy="21" r="4.6" fill="#fff"/><circle cx="31" cy="21" r="4.6" fill="#fff"/>
  <circle cx="18" cy="21.6" r="2.1" fill="#2a0612"/><circle cx="32" cy="21.6" r="2.1" fill="#2a0612"/>
  <path d="M18.5 30.5q5.5 4.6 11 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
 </svg>;
}
