export type Field = {key:string;label:string;type?:'text'|'textarea'|'markdown'|'select'|'number'|'image'|'array'|'boolean'|'url';options?:string[];required?:boolean;taxonomy?:boolean};
// Project dropdowns whose options live in project_categories (managed under Projects > Categories).
export const projectTaxonomy=['category','sub_category','work_category'] as const;
// creatable: an inbox collection staff can also add to by hand. noun: singular name for buttons.
export type Collection = {label:string;fields:Field[];management?:boolean;superOnly?:boolean;inbox?:boolean;creatable?:boolean;noun?:string};
const title:Field={key:'title',label:'Title',required:true};
const slug:Field={key:'slug',label:'URL slug',required:true};
const status:Field={key:'status',label:'Publishing status',type:'select',options:['draft','review','published']};
const image:Field={key:'cover_image',label:'Cover image',type:'image'};
export const collections:Record<string,Collection>={
 blog_posts:{label:'Blog posts',fields:[title,slug,{key:'excerpt',label:'Excerpt',type:'textarea'}, {key:'content',label:'Article body',type:'markdown',required:true},image,{key:'category_id',label:'Category',type:'select'},{key:'author_name',label:'Public author name',required:true},status]},
 blog_categories:{label:'Blog categories',management:true,fields:[{key:'name',label:'Name',required:true},slug]},
 projects:{label:'Projects',fields:[title,slug,{key:'category',label:'Category',type:'select',taxonomy:true,required:true},{key:'sub_category',label:'Subcategory',type:'select',taxonomy:true},{key:'work_category',label:'Selected work tab',type:'select',taxonomy:true},{key:'industry_tag',label:'Industry',required:true},image,{key:'client_name',label:'Client name'},{key:'short_description',label:'Short description',type:'textarea'},{key:'goal',label:'The goal',type:'textarea'},{key:'what_was_achieved',label:'What was achieved',type:'markdown'},{key:'tools_used',label:'Tools (comma separated)',type:'array'},{key:'satisfaction_rate',label:'Verified satisfaction rate (%)',type:'number'},{key:'featured',label:'Feature on homepage',type:'boolean'},status]},
 project_images:{label:'Project gallery',fields:[{key:'project_id',label:'Project',type:'select',required:true},{key:'image_url',label:'Image',type:'image',required:true},{key:'order',label:'Display order',type:'number'}]},
 testimonials:{label:'Testimonials',fields:[{key:'client_name',label:'Client name',required:true},{key:'client_role',label:'Role / company'},{key:'quote',label:'Approved client quote',type:'textarea',required:true},{key:'rating',label:'Rating (1–5)',type:'number'},{key:'photo_url',label:'Client photo',type:'image'},{key:'project_id',label:'Project',type:'select'},status]},
 team_members:{label:'Team',fields:[{key:'name',label:'Name',required:true},{key:'role',label:'Role',required:true},{key:'bio',label:'Biography',type:'textarea'},{key:'photo_url',label:'Portrait',type:'image'},{key:'order',label:'Display order',type:'number'},status]},
 pages_content:{label:'Page content',management:true,fields:[{key:'page_key',label:'Page',type:'select',options:['home','about','services','pricing','brand-partnerships','careers','resources','contact','privacy-policy','terms-of-service'],required:true},{key:'section_key',label:'Section key (intro, story, mission, vision, purpose or body)',required:true},{key:'content',label:'Content',type:'markdown',required:true}]},
 resources:{label:'Resources',fields:[title,{key:'description',label:'Description',type:'textarea'},{key:'category',label:'Topic',required:true},{key:'download_url',label:'Download URL',type:'url',required:true},status]},
 jobs:{label:'Careers',fields:[title,{key:'location',label:'Location',required:true},{key:'employment_type',label:'Employment type',type:'select',options:['Full-time','Part-time','Contract','Internship']},{key:'description',label:'Role description',type:'markdown',required:true},status]},
 leads:{label:'Leads',management:true,inbox:true,fields:[{key:'status',label:'Status',type:'select',options:['new','contacted','qualified','proposal','won','lost']}]},
 contact_submissions:{label:'Contacts & applications',management:true,inbox:true,creatable:true,noun:'contact',fields:[{key:'name',label:'Name',required:true},{key:'email',label:'Email',required:true},{key:'phone',label:'Phone'},{key:'company',label:'Company'},{key:'subject',label:'Subject',required:true},{key:'message',label:'Message / notes',type:'textarea',required:true},{key:'status',label:'Status',type:'select',options:['new','in_progress','resolved']}]},
 subscribers:{label:'Subscribers',management:true,inbox:true,fields:[]},
 users:{label:'Users & roles',superOnly:true,inbox:true,fields:[{key:'name',label:'Name'},{key:'role',label:'Role',type:'select',options:['','editor','sales','finance','admin','super_admin']}]},
 settings:{label:'Settings',superOnly:true,fields:[{key:'key',label:'Setting',type:'select',required:true,options:['site_title','site_description','contact_email','phone','whatsapp_url','instagram_url','linkedin_url','calendly_url','invoice_from','invoice_bank_details','invoice_footer']},{key:'value',label:'Value',type:'textarea',required:true}]},
};
// Staff roles. super_admin/admin see everything (admin minus users + settings); the others are scoped to one area.
export const roles=['super_admin','admin','editor','sales','finance'] as const;
export type Role=typeof roles[number];
export const roleInfo:Record<Role,{label:string;summary:string;areas:string[]}>={
 super_admin:{label:'Super admin',summary:'Full control of the studio.',areas:['Everything','Staff accounts','Site settings']},
 admin:{label:'Admin',summary:'Runs the studio day to day.',areas:['Everything','Not staff or settings']},
 editor:{label:'Editor',summary:'Writes and sends content.',areas:['Blog','Site content','Media','Campaigns','Subscribers']},
 sales:{label:'Sales',summary:'Works leads and clients.',areas:['Leads CRM','Contacts','Invoices (view)']},
 finance:{label:'Finance',summary:'Bills clients and tracks payments.',areas:['Invoices','Payments','Bank accounts']},
};
export const isAdmin=(role?:string|null)=>role==='super_admin'||role==='admin';
// Non-content areas; everything else in collections is site content.
const area:Record<string,'crm'|'finance'|'content'|'mail'>={leads:'crm',contact_submissions:'crm',subscribers:'mail',newsletter:'mail',invoices:'finance',media:'content'};
export function allowed(key:string,role:string){
 const c=collections[key];if(!c&&!(key in area))return false;
 if(role==='super_admin')return true;
 if(c?.superOnly)return false;
 if(role==='admin')return true;
 const a=area[key]??'content';
 if(role==='editor')return a==='mail'||(a==='content'&&!c?.management);
 if(role==='sales')return a==='crm';
 if(role==='finance')return a==='finance';
 return false;
}
export function safeUrl(value:unknown){if(typeof value!=='string')return '';try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return value.startsWith('/')&&!value.startsWith('//')?value:'';}}
