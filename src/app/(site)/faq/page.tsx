import {PageHero,Section,CTA} from '@/components/PageParts';
import FAQList from '@/components/FAQList';
import {faqs} from '@/lib/content';
export const metadata={title:'Frequently asked questions | Zaane',description:'Answers about our process, timelines, pricing, support and working together.'};
export default function Page(){return <main id="main" className="site-main"><PageHero label="A little clarity" title="Good questions. Clear answers." intro="A few things you might want to know before we work together."/><Section title="What’s on your mind?"><FAQList items={faqs} filter/></Section><CTA/></main>;}
