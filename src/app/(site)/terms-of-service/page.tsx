import {PageHero,Copy} from '@/components/PageParts';
import {pageCopy} from '@/lib/content';
export const metadata={title:'Terms of service | Zaane'};
const copy=`## About these terms
These terms describe use of the Zaane website. Any paid engagement is governed by the written proposal and agreement accepted by the parties.

## Services
Zaane offers design, development, MVP development and brand partnership services. Website descriptions are an overview; they are not a binding scope, price or delivery commitment.

## Your responsibilities
Provide accurate information, share only material you have permission to use and do not attempt to disrupt the website or access restricted areas. Sending an inquiry does not establish a service agreement.

## Payment terms
Fees, deposits, payment schedules, expenses and cancellation arrangements are set out in the agreement for each project. No payment is collected through this website.

## Intellectual property
Website materials belong to their respective owners. Ownership and licensing of project deliverables, source files and third-party materials are defined in the applicable project agreement.

## Availability and liability
We aim to keep website information accurate and available, but it may change or become temporarily unavailable. Any applicable limits of liability for paid work must be set out in the project agreement and remain subject to applicable law.

## Ending an engagement
Either party may end an engagement in accordance with its written agreement. That agreement sets out notice requirements, outstanding payments and handover arrangements.

## Governing law
The governing law and dispute process for a paid engagement will be specified in its written agreement. Nothing here is intended to remove rights that cannot lawfully be excluded.

## Contact
For questions about these terms or a proposed engagement, contact hello@zaane.co.`;
export default async function Page(){return <main id="main" className="site-main"><PageHero label="The details" title="Terms of service." intro="A shared understanding before we get started."/><div className="article-body"><Copy text={await pageCopy('terms-of-service','body',copy)}/></div></main>;}
