import 'server-only';
import {configured,publicClient} from './supabase/server';
import {cache} from 'react';
export type ContentRow={id:string;[key:string]:unknown};
export const records=cache(async(table:string):Promise<ContentRow[]>=>{
 if(!configured())return [];
 let query=publicClient().from(table).select('*');
 if(['projects','blog_posts','testimonials','team_members','resources','jobs'].includes(table))query=query.eq('status','published');
 if(table==='blog_posts')query=query.lte('published_at',new Date().toISOString());
 const {data,error}=await query.order(['team_members','project_images'].includes(table)?'order':'created_at',{ascending:['team_members','project_images'].includes(table)});
 if(error){console.error('Public content query failed:',table,error.code);throw new Error('Content is temporarily unavailable. Please try again.');}
 return data||[];
});
export const settings=cache(async()=>Object.fromEntries((await records('settings')).map(r=>[String(r.key),String(r.value)])));
export async function pageCopy(page:string,section:string,fallback:string){const rows=await records('pages_content');return String(rows.find(r=>r.page_key===page&&r.section_key===section)?.content||fallback);}
export const services=['Graphics & Brand Design','UI/UX Design','Web Development','App Development','MVP Development','Brand Partnerships'];
export const faqs=[
 {category:'Process',q:'How do we get started?',a:'Tell us about your project through our Services form. We’ll review the brief, arrange a discovery call, and share a proposal with scope, milestones and deliverables.'},
 {category:'Process',q:'Will I be involved throughout the project?',a:'Yes. We agree on review points at the start, share progress, and ask for your feedback before moving to the next milestone.'},
 {category:'Pricing & Payment',q:'How much will my project cost?',a:'Pricing depends on scope, complexity and the work your team needs. Our packages describe the engagement options; your written proposal sets the exact price.'},
 {category:'Pricing & Payment',q:'How are payments structured?',a:'We agree on a deposit and milestone payments in your proposal. Retainers are billed on the schedule set out in your agreement.'},
 {category:'Timelines',q:'How long does a project take?',a:'A focused brand or website engagement has a different timeline from a full application. We confirm the delivery plan after discovery and agree on priorities before starting.'},
 {category:'Support & Revisions',q:'What happens after launch?',a:'We hand over the agreed files, documentation and access. You can also choose ongoing support for maintenance, improvements and new features.'},
 {category:'Support & Revisions',q:'How do revisions work?',a:'Your proposal includes review rounds. We collect feedback at each milestone; new scope or additional rounds are discussed and approved before work begins.'},
 {category:'Working With Us',q:'Do you work with early-stage founders?',a:'Yes. Our MVP engagement helps you define the smallest useful version of your product, validate the core journey and prepare for your first users.'},
 {category:'Working With Us',q:'Can you collaborate with our existing team?',a:'Yes. We can support a specific discipline, work alongside an in-house team, or own the design and build from discovery through launch.'},
];
