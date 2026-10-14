import 'server-only';
import {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,ListObjectsV2Command,DeleteObjectCommand,type _Object} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
// Cloudflare R2 holds every admin upload; files are served from R2_PUBLIC_URL.
let client:S3Client|null=null;
// Checksums only when required: otherwise signed upload links carry a checksum of an empty body and R2 rejects real uploads.
const s3=()=>client??=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID!,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY!},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
export const r2Configured=()=>!!(process.env.R2_ENDPOINT&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY&&process.env.R2_BUCKET&&process.env.R2_PUBLIC_URL);
export const publicUrl=(key:string)=>`${process.env.R2_PUBLIC_URL!.replace(/\/$/,'')}/${key}`;
export const keyFromUrl=(url:string)=>{const base=process.env.R2_PUBLIC_URL!.replace(/\/$/,'')+'/';return url.startsWith(base)?decodeURIComponent(url.slice(base.length)):null;};
export const MEDIA_PREFIX='media/';
export const imageTypes:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/gif':'gif','image/svg+xml':'svg'};
export async function putFile(file:File,name?:string){
 const slug=(name??file.name).toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,60)||'image';
 const key=`${MEDIA_PREFIX}${new Date().toISOString().slice(0,7)}/${slug}-${crypto.randomUUID().slice(0,8)}.${imageTypes[file.type]}`;
 await s3().send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:new Uint8Array(await file.arrayBuffer()),ContentType:file.type,CacheControl:'public, max-age=31536000, immutable'}));
 return {key,url:publicUrl(key)};
}
export async function putBytes(key:string,body:Uint8Array,contentType:string){
 await s3().send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:body,ContentType:contentType,CacheControl:'public, max-age=31536000, immutable'}));
 return publicUrl(key);
}
export async function listFiles(){
 const out:_Object[]=[];let token:string|undefined;
 do{const r=await s3().send(new ListObjectsV2Command({Bucket:process.env.R2_BUCKET,Prefix:MEDIA_PREFIX,ContinuationToken:token}));out.push(...(r.Contents??[]));token=r.IsTruncated?r.NextContinuationToken:undefined;}while(token);
 return out.filter(o=>o.Key&&!o.Key.endsWith('/')).map(o=>({key:o.Key!,url:publicUrl(o.Key!),size:o.Size??0,modified:o.LastModified?.toISOString()??''}));
}
export async function deleteFile(key:string){await s3().send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}));}
// Client files (CRM materials) live under private/ and are only ever served through an admin route, never linked publicly.
export const PRIVATE_PREFIX='private/';
export async function putPrivate(key:string,body:Uint8Array,contentType:string,filename:string){
 await s3().send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:PRIVATE_PREFIX+key,Body:body,ContentType:contentType,ContentDisposition:`attachment; filename="${filename.replace(/["\\\r\n]/g,'')}"`}));
 return PRIVATE_PREFIX+key;
}
export async function getPrivate(key:string){
 if(!key.startsWith(PRIVATE_PREFIX))throw new Error('Not a private file');
 const r=await s3().send(new GetObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}));
 return {body:r.Body!.transformToWebStream(),type:r.ContentType??'application/octet-stream',size:r.ContentLength};
}
// Short-lived signed links so big files go browser <-> R2 directly (Vercel caps request bodies at 4.5 MB).
export async function signPut(key:string,type:string){return getSignedUrl(s3(),new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,ContentType:type}),{expiresIn:600});}
export async function signGet(key:string,filename:string){return getSignedUrl(s3(),new GetObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,ResponseContentDisposition:`attachment; filename="${filename.replace(/["\\\r\n]/g,'')}"`}),{expiresIn:300});}
export async function headPrivate(key:string){try{const r=await s3().send(new HeadObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}));return {size:r.ContentLength??0,type:r.ContentType??''};}catch{return null;}}
