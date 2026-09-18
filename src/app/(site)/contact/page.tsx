import Link from 'next/link';
import {PageHero,Section,CTA} from '@/components/PageParts';
import InquiryForm from '@/components/InquiryForm';
import {settings,pageCopy} from '@/lib/content';
import {safeUrl} from '@/lib/cms';
export const metadata={title:'Contact | Zaane',description:'Let’s talk about your next project, collaboration or question.'};
export default async function Page(){const s=await settings();return <main id="main" className="site-main"><PageHero label="Let’s talk" title="A conversation can change everything." intro={await pageCopy('contact','intro','Have a question, a collaboration in mind, or something you think we should hear? We’re listening.')}/><Section title="Drop us a note."><div className="inquiry-panel"><div><h3>Direct is good.</h3><a className="contact-email" href={`mailto:${s.contact_email||'hello@zaane.co'}`}>{s.contact_email||'hello@zaane.co'} ↗</a>{s.phone&&<p><a href={`tel:${s.phone.replace(/[^+\d]/g,'')}`}>{s.phone}</a></p>}<div className="social-links">{['whatsapp','instagram','linkedin'].map(k=>safeUrl(s[`${k}_url`])&&<a key={k} href={safeUrl(s[`${k}_url`])} target="_blank" rel="noreferrer">{k} ↗</a>)}</div><p>Planning a new project?</p><Link className="text-link" href="/services#inquiry">Send a project brief →</Link></div><InquiryForm kind="contact"/></div></Section><CTA/></main>;}
