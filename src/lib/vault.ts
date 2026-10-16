import 'server-only';
import {createCipheriv,createDecipheriv,randomBytes} from 'crypto';
// AES-256-GCM. The key lives only in the VAULT_KEY environment variable; the database holds scrambled text.
// Stored format: v1.<iv>.<auth tag>.<ciphertext> (all base64). Losing the key makes stored passwords unrecoverable.
const key=()=>{const raw=process.env.VAULT_KEY;if(!raw)return null;const b=Buffer.from(raw,'base64');return b.length===32?b:null;};
export const vaultReady=()=>!!key();
export function encrypt(plain:string){
 const k=key();if(!k)throw new Error('Vault key missing');
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',k,iv),enc=Buffer.concat([c.update(plain,'utf8'),c.final()]);
 return ['v1',iv.toString('base64'),c.getAuthTag().toString('base64'),enc.toString('base64')].join('.');
}
export function decrypt(stored:string){
 const k=key();if(!k)throw new Error('Vault key missing');
 const [v,iv,tag,data]=stored.split('.');if(v!=='v1'||!iv||!tag||!data)throw new Error('Bad format');
 const d=createDecipheriv('aes-256-gcm',k,Buffer.from(iv,'base64'));d.setAuthTag(Buffer.from(tag,'base64'));
 return Buffer.concat([d.update(Buffer.from(data,'base64')),d.final()]).toString('utf8');
}
