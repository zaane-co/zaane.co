import {CircleAlert,CircleCheck,Info} from 'lucide-react';

export type FlashTone='success'|'error'|'info';
// Most flash strings come from catch blocks without a tone, so failures are recognised by their wording.
const failure=/could ?n[o’']t|can[’']t|cannot|failed|fail\b|error|invalid|denied|not permitted|not allowed|something went wrong|try again|required|too (long|large|big)|only (a|an|super)|enter (a|an|their|your)|choose|select (a|an)|first\.|missing|no longer|expired|not configured|already exists/i;

// A solid-colour notice for the result of an action: green when it worked, red when it didn't.
export default function Flash({children,tone,className='',style}:{children:React.ReactNode;tone?:FlashTone;className?:string;style?:React.CSSProperties}){
 const t=tone??(typeof children==='string'&&failure.test(children)?'error':'success');
 const Icon=t==='error'?CircleAlert:t==='info'?Info:CircleCheck;
 return <p role={t==='error'?'alert':'status'} className={`za-flash is-${t} ${className}`} style={style}><Icon size={16}/><span>{children}</span></p>;
}
