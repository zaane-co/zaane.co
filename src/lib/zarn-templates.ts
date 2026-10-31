// To-do templates: an ordered list of tasks grouped into phases. A phase becomes the task's Type.
export type TemplateItem={title:string;phase?:string;description?:string;priority?:'low'|'medium'|'high'};
export type Template={id:string;name:string;description:string;items:TemplateItem[];builtin?:boolean;created_by?:string|null};

export const LIMITS={title:200,phase:40,description:1000,items:300};

// One line per task. A heading starts a phase. "Title | description" adds detail and a leading "!" marks it high priority.
// If the text has any list lines (- , * , 1. , - [ ] ) only those become tasks; otherwise every plain line does.
export function parseOutline(text:string):TemplateItem[]{
 const lines=text.replace(/\r/g,'').split('\n');
 const marker=/^\s*(?:[-*+•]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/;
 const hasList=lines.some(l=>marker.test(l));
 const items:TemplateItem[]=[];let phase='';
 for(const raw of lines){
  const line=raw.trim();if(!line)continue;
  const h=line.match(/^#{1,6}\s+(.*)$/);
  if(h){phase=clean(h[1]).slice(0,LIMITS.phase);continue;}
  if(line.startsWith('|')||/^[-=_*]{3,}$/.test(line))continue;
  if(hasList&&!marker.test(raw))continue;
  let body=clean(line.replace(marker,''));
  let priority:TemplateItem['priority'];
  if(body.startsWith('!')){priority='high';body=body.slice(1).trim();}
  const [title,...rest]=body.split('|');
  const t=clean(title).slice(0,LIMITS.title);if(!t)continue;
  const description=clean(rest.join('|')).slice(0,LIMITS.description);
  items.push({title:t,...(phase?{phase}:{}),...(description?{description}:{}),...(priority?{priority}:{})});
  if(items.length>=LIMITS.items)break;
 }
 return items;
}
const clean=(s:string)=>s.replace(/\*\*|__|`/g,'').replace(/\s+/g,' ').trim();

// The same format back, so a template can be edited as text.
export function toOutline(items:TemplateItem[]){
 const out:string[]=[];let phase:string|undefined;
 for(const it of items){
  if(it.phase!==phase){phase=it.phase;if(phase){if(out.length)out.push('');out.push(`## ${phase}`);}}
  out.push(`- ${it.priority==='high'?'!':''}${it.title}${it.description?` | ${it.description}`:''}`);
 }
 return out.join('\n');
}

export const phasesOf=(items:TemplateItem[])=>{
 const order:string[]=[];for(const it of items){const p=it.phase??'';if(!order.includes(p))order.push(p);}
 return order;
};

type Row=[title:string,description?:string,high?:boolean];
const phase=(name:string,rows:Row[]):TemplateItem[]=>rows.map(([title,description,high])=>({title,phase:name,...(description?{description}:{}),...(high?{priority:'high' as const}:{})}));

const SECRET_NOTE='Log it in the credentials document the moment you create it. Never paste keys into chat, GitHub or code.';

const projectDelivery:TemplateItem[]=[
 ...phase('0. Before you start',[
  ['Install Claude on your computer and sign in'],
  ['Create the "[Project name] Credentials" document','Every password, API key and token goes in it as soon as you create it. Share it only with the project lead and the people on the project. Secret keys (Supabase Service Role, Paystack secret, Cloudflare secret, Resend API key) live in environment variables only. Turn on two-step authentication on every account you create.',true],
 ]),
 ...phase('1. Accounts and tools',[
  ['Create the project Gmail','Create this first and register every other account with it.',true],
  ['Create the GitHub organization','Code hosting and team access.'],
  ['Create the Vercel account','Hosting and deployments.'],
  ['Buy the domain on Namecheap'],
  ['Create the Resend account','Transactional email.'],
  ['Create the Supabase account','Database and authentication.'],
  ['Create the Cloudflare account','Storage bucket and Turnstile.'],
  ['Set up the card for subscriptions'],
  ['Create the Paystack or Flutterwave account','Payment gateway for customer payments. Use whichever the client needs.'],
  ['Set up Google Search Console','Search visibility for the live site.'],
  ['Set up the image collector','For collecting the images the site needs.'],
  ['Set up Claude Code'],
  ['Set up ChatGPT'],
  ['Get a phone number for verification codes'],
  ['Set up any extra API the project needs'],
  ['Set up React Bits','UI component library.'],
 ]),
 ...phase('2. GitHub',[
  ['Sign in to GitHub with the project Gmail'],
  ['Create the project organization and set it up'],
  ['Create the code repository inside the organization'],
  ['Add team members to the organization'],
  ['Turn on two-step authentication'],
  ['Link the repository to Vercel','Done in phase 5.'],
  ['Log the organization name and repository URL',SECRET_NOTE],
 ]),
 ...phase('3. Supabase',[
  ['Create the Supabase project','Name it after the client project and save the database password in the credentials document.'],
  ['Set up the database tables and turn on RLS','Create the Postgres tables, then turn on Row Level Security on every table.',true],
  ['Copy the project URL','Project Settings.'],
  ['Copy the Publishable (anon) key and the Service Role key','API Keys. The Service Role key is secret and goes in environment variables only.',true],
  ['Create an access token for the SQL tables and log it'],
  ['Review the email settings','Authentication, then Emails.'],
  ['Turn on the Email and Google sign-in providers'],
  ['Set the Site URL and Redirect URLs','Site URL is the live domain. Add the redirect URLs the app uses.'],
  ['Connect Resend to Supabase','After the Resend phase, so sign-up and reset emails come from the project domain.'],
 ]),
 ...phase('4. Cloudflare',[
  ['Create a storage bucket for the uploads'],
  ['Log the bucket name and ID'],
  ['Create an API token for the bucket','Copy the Access key and the Secret key.'],
  ['Turn on the Public Dev URL and log it','Confirm with the project lead before relying on it for a live client site.'],
  ['Create a Turnstile widget for the forms','Copy its site key and secret key.'],
  ['Log every Cloudflare item in the credentials document'],
 ]),
 ...phase('5. Vercel',[
  ['Create the Vercel project from the GitHub repository'],
  ['Turn on two-step authentication','Security settings.'],
  ['Add the domain in Vercel and follow the DNS instructions','Buy the domain on Namecheap first.'],
  ['Add the Resend DNS records','TXT, MX and DMARC records, once the Resend phase gives them to you.'],
  ['Add every key as an environment variable','Supabase, Cloudflare, Resend and Paystack or Flutterwave.',true],
  ['Deploy and confirm the live domain loads'],
 ]),
 ...phase('6. Resend',[
  ['Create a Resend API key and log it'],
  ['Set up the project domain in Resend'],
  ['Add the TXT, MX and DMARC records in the domain DNS, then verify','DNS is managed in Vercel.'],
  ['Connect Resend to Supabase in the email settings'],
  ['Send a test email and confirm it arrives'],
 ]),
 ...phase('7. Payments',[
  ['Create the business account on Paystack or Flutterwave'],
  ['Copy the Public key and the Secret key','The Secret key goes in environment variables only.',true],
  ['Set up the webhook and log its URL','So payment events reach the app.'],
  ['Test the full payment flow with test keys','Only then switch to live keys.',true],
  ['Log every payment key in the credentials document'],
 ]),
 ...phase('8. Dev environment',[
  ['Open VS Code'],
  ['Set up Claude and sign in'],
  ['Set up ChatGPT'],
  ['Connect GitHub and clone the project repository'],
  ['Install Node.js'],
  ['Install Playwright for browser testing'],
  ['Set up the project md files','The standard list of md files is still to be decided. Add it here.'],
 ]),
 ...phase('9. Build the app',[
  ['Build the website pages','Home, About, Features or Services, Blog, Contact, Case study, Demo. Use React Bits for components and the image collector for images.'],
  ['Build authentication','Admin login, user login and signup, business login and signup, customer login and signup.',true],
  ['Set up the database','Supabase, with the keys, URL configuration and Resend connected.'],
  ['Set up storage','Cloudflare, with Turnstile on the public forms.'],
  ['Build the admin dashboard header','Logo, welcome greeting, search bar, notification bell, message bell, avatar menu (Wallet, Profile, Settings, Sign out).'],
  ['Build the admin dashboard sidebar','Only the modules the client scope covers: Dashboard, Media, Blog, Project, Settings, Users, Analytics, Finance, Logistics, Booking, Reporting, Sales, Course or document upload, Products.'],
  ['Add dark mode and light mode'],
  ['Make it a PWA'],
 ]),
 ...phase('10. Security checklist',[
  ['Test sign-up, login, password reset and Google sign-in for every user type','Authentication.',true],
  ['Check each user type only sees and does what its role allows','Admin, editor, business, customer, user. RLS is on for every Supabase table.',true],
  ['Confirm no secret key is in front-end code or GitHub',undefined,true],
  ['Confirm two-step authentication is on for every account'],
  ['Confirm Turnstile is on the public forms'],
  ['Run the key flows in Playwright'],
  ['Add the live site to Google Search Console'],
  ['Tick every item in the app checklist document'],
 ]),
 ...phase('11. Delivery',[
  ['Ask the client to review the project'],
  ['Make the changes they request'],
  ['Set up the documentation'],
  ['Request the outstanding payment'],
  ['Hand over the env files','Part of the project transfer.'],
  ['Hand over the login details and passwords','Part of the project transfer.'],
  ['Disconnect the project from GitHub','Part of the project transfer.'],
  ['Request a testimonial'],
  ['Send a thank you email'],
  ['Discuss further work'],
 ]),
];

export const BUILTIN_TEMPLATES:Template[]=[
 {id:'builtin:project-setup',name:'Project setup and delivery',description:'Every step of a new app, from the project Gmail to handover: accounts, GitHub, Supabase, Cloudflare, Vercel, Resend, payments, build, security checks and delivery.',items:projectDelivery,builtin:true},
];
