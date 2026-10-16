import 'server-only';
import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'crypto';
// Password-protected document links: passwords are stored as salted scrypt hashes; an unlocked link is remembered
// for an hour in a signed cookie.
const secret=()=>(process.env.RATE_LIMIT_SALT||process.env.SUPABASE_SERVICE_ROLE_KEY||'dev')+'doc-link';
export const newToken=()=>randomBytes(24).toString('base64url');
export function hashPassword(p:string){const salt=randomBytes(16);return `${salt.toString('hex')}:${scryptSync(p,salt,32).toString('hex')}`;}
export function checkPassword(p:string,stored:string){
 const [s,h]=stored.split(':');if(!s||!h)return false;
 const a=scryptSync(p,Buffer.from(s,'hex'),32),b=Buffer.from(h,'hex');
 return a.length===b.length&&timingSafeEqual(a,b);
}
export const cookieName=(token:string)=>'zd_'+createHmac('sha256',secret()).update(token).digest('hex').slice(0,16);
export function signUnlock(token:string,minutes=60){const exp=Date.now()+minutes*60_000;return `${exp}.${createHmac('sha256',secret()).update(`${token}.${exp}`).digest('hex')}`;}
export function verifyUnlock(token:string,value:string|undefined){
 if(!value)return false;const [exp,sig]=value.split('.');if(!exp||!sig||Number(exp)<Date.now())return false;
 const want=createHmac('sha256',secret()).update(`${token}.${exp}`).digest('hex');
 return sig.length===want.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(want));
}
