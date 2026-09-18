'use client';
import {useState} from 'react';
import Link from 'next/link';
import {safeUrl} from '@/lib/cms';
const services=['Graphics & Brand Design','UI/UX Design','Web Development','App Development','MVP Development','Brand Partnerships'];
export default function InquiryForm({kind='project',booking='',subject=''}:{kind?:'project'|'contact'|'partnership'|'application'|'subscribe';booking?:string;subject?:string}){
 const [busy,setBusy]=useState(false),[success,setSuccess]=useState(false),[message,setMessage]=useState('');
 const bookingUrl=safeUrl(booking);const calendar=bookingUrl&&new URL(bookingUrl,'https://zaane.co').hostname==='calendly.com'?bookingUrl:'';
 if(success)return <div className="form-success" role="status"><span className="eyebrow">Message received</span><h3>{kind==='subscribe'?'You’re on the list.':'A good beginning.'}</h3><p>{kind==='subscribe'?'Thanks for subscribing to studio resources and updates.':'Your details have been saved. Our team will follow up by email.'}</p>{calendar&&kind==='project'&&<><h4>Next, choose a time to talk.</h4><iframe src={calendar} title="Schedule a discovery call with Zaane" loading="lazy" className="booking-frame"/><a className="text-link" href={calendar} target="_blank" rel="noreferrer">Open booking in a new tab ↗</a></>}</div>;
 return <form className="contact-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');const data=new FormData(e.currentTarget);try{const result=await fetch('/api/inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(data),kind,consent:data.get('consent')==='on'})});const body=await result.json();if(!result.ok)throw new Error(body.error);setSuccess(true);}catch(error){setMessage(error instanceof Error?error.message:'Could not send. Please try again.');}finally{setBusy(false);}}}>
 {kind!=='subscribe'&&<label>Your name<input name="name" autoComplete="name" placeholder="Alex Taylor" maxLength={120} required/></label>}<label>Email address<input name="email" type="email" autoComplete="email" placeholder="alex@company.com" maxLength={254} required/></label>
 {['project','partnership'].includes(kind)&&<label>Company / brand name<input name="company" autoComplete="organization" placeholder="Your company" maxLength={200}/></label>}
 {kind==='project'&&<><label>Service interested in<select name="service" defaultValue="" required><option value="" disabled>Select a service</option>{services.map(s=><option key={s}>{s}</option>)}</select></label><label>Project budget <span className="optional">Optional · USD</span><select name="budget" defaultValue=""><option value="">Let’s discuss</option>{['Under $2,500','$2,500–$5,000','$5,000–$10,000','$10,000–$25,000','$25,000+'].map(v=><option key={v}>{v}</option>)}</select></label></>}
 {kind==='contact'&&<label>Reason for getting in touch<select name="subject" required><option>General inquiry</option><option>Existing project support</option><option>Press & collaboration</option><option>Something else</option></select></label>}
 {kind==='application'&&<label>Role<input name="subject" defaultValue={subject} placeholder="Role you’re interested in" required maxLength={200}/></label>}
 {kind!=='subscribe'&&<label>{kind==='application'?'Introduce yourself and include your portfolio / CV link':'Tell us a little more'}<textarea name="message" rows={4} minLength={10} maxLength={10000} placeholder="The idea, the challenge, the ambition…" required/></label>}
 <div className="honeypot" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
 <label className="consent"><input type="checkbox" name="consent" required/><span>{kind==='subscribe'?'I agree to receive resource updates by email.':'I agree to Zaane using these details to respond to my inquiry.'} Read the <Link href="/privacy-policy">privacy policy</Link>.</span></label>
 <button className="studio-button black-button" disabled={busy}>{busy?'Sending…':kind==='subscribe'?'Keep me in the loop →':'Send inquiry →'}</button><p role="status" className="form-feedback">{message}</p>
 </form>;
}
