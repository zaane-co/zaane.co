import {PageHero,Copy} from '@/components/PageParts';
import {pageCopy} from '@/lib/content';
export const metadata={title:'Privacy policy | Zaane'};
const copy=`## Introduction
This notice explains how information submitted through the Zaane website is handled. For questions, contact hello@zaane.co.

## Information we collect
When you submit a form, we collect the details you provide, such as your name, email, company, project brief, budget or application links. Subscription forms collect your email and consent. Technical identifiers may be processed to protect forms from abuse.

## How we use your information
We use inquiries to respond to you, discuss potential work and manage our communications. Application information is used to consider your interest in working with us. If you subscribe, we use your email to send resource and studio updates.

## Cookies and tracking
Staff sign-in uses authentication cookies. The public site does not currently include advertising analytics. Opening an embedded scheduling calendar connects to the scheduling provider, whose own privacy practices apply.

## Third-party services
Website hosting, database storage, email delivery and scheduling providers may process information to deliver these functions. Access to submissions is restricted to authorised staff. We do not sell form submissions.

## Data security and retention
We use access controls to protect submissions. We retain information while it is needed for the purpose described here and review deletion requests received at our contact address. No online system can guarantee absolute security.

## Your choices
You can ask to access, correct or delete information you have submitted. You can withdraw consent to resource emails by contacting us. Any rights that apply depend on your location and the circumstances.

## Contact
Email hello@zaane.co with privacy questions or requests.`;
export default async function Page(){return <main id="main" className="site-main"><PageHero label="The details" title="Privacy policy." intro="How we handle the information you choose to share with us."/><div className="article-body"><Copy text={await pageCopy('privacy-policy','body',copy)}/></div></main>;}
