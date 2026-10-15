// Every key the Settings page edits, grouped as it appears there. The site reads them through settings() in lib/content.
export type SettingField={key:string;label:string;type:'text'|'email'|'tel'|'url'|'textarea'|'image'|'currency';placeholder?:string;hint?:string};
export type SettingGroup={id:string;title:string;summary:string;fields:SettingField[]};
export const settingGroups:SettingGroup[]=[
 {id:'general',title:'General',summary:'How the website appears in search results and browser tabs.',fields:[
  {key:'site_title',label:'Site title',type:'text',placeholder:'Zaane: Design, Development & MVPs'},
  {key:'site_description',label:'Site description',type:'textarea',placeholder:'Zaane is an independent studio for brand design, UI/UX, web and app development…',hint:'Shown under your link on Google. Keep it under 160 characters.'},
 ]},
 {id:'contact',title:'Contact',summary:'Shown on the Contact page and used for booking discovery calls.',fields:[
  {key:'contact_email',label:'Contact email',type:'email',placeholder:'hello@zaane.co'},
  {key:'phone',label:'Phone',type:'tel',placeholder:'+234 800 000 0000'},
  {key:'calendly_url',label:'Booking link',type:'url',placeholder:'https://calendly.com/zaane/discovery',hint:'Offered after someone sends a project brief.'},
 ]},
 {id:'social',title:'Social links',summary:'Links in the footer and on the Contact page. Leave a field empty to hide it.',fields:[
  {key:'instagram_url',label:'Instagram',type:'url',placeholder:'https://instagram.com/zaane'},
  {key:'linkedin_url',label:'LinkedIn',type:'url',placeholder:'https://linkedin.com/company/zaane'},
  {key:'x_url',label:'X',type:'url',placeholder:'https://x.com/zaane'},
  {key:'facebook_url',label:'Facebook',type:'url',placeholder:'https://facebook.com/zaane'},
  {key:'whatsapp_url',label:'WhatsApp',type:'url',placeholder:'https://wa.me/2348000000000'},
 ]},
 {id:'invoices',title:'Invoices',summary:'Printed on every invoice you send from the CRM.',fields:[
  {key:'invoice_from',label:'From',type:'textarea',placeholder:'Zaane\nhello@zaane.co\nLagos, Nigeria',hint:'The first line is used as your business name.'},
  {key:'invoice_bank_details',label:'Other payment instructions',type:'textarea',placeholder:'e.g. Please use the invoice number as the payment reference',hint:'Optional. Printed under the bank account.'},
  {key:'invoice_footer',label:'Footer note',type:'text',placeholder:'Thank you for working with Zaane.'},
 ]},
 {id:'about',title:'About page images',summary:'Replace the photos on the About page. Empty fields use the default photos.',fields:[
  {key:'about_hero_image',label:'Hero image',type:'image'},
  {key:'about_story_image_1',label:'Story image 1',type:'image'},
  {key:'about_story_image_2',label:'Story image 2',type:'image'},
 ]},
];
export const settingKeys=settingGroups.flatMap(g=>g.fields);
