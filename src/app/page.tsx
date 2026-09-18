import Footer from "@/components/Footer";
import StudioMotion from "@/components/StudioMotion";
import ScrollReveal from "@/components/ScrollReveal";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Services from "@/components/sections/Services";

import Process from "@/components/sections/Process";
import Partnership from "@/components/sections/Partnership";
import Pricing from "@/components/sections/Pricing";
import Questions from "@/components/sections/Questions";
import Contact from "@/components/sections/Contact";
import Link from "next/link";
import { records, pageCopy } from "@/lib/content";
import { ProjectCard, Testimonials, Copy } from "@/components/PageParts";
export default async function Home() {
  const [projects, quotes] = await Promise.all([records('projects'), records('testimonials')]);
  const featured = projects.filter(p=>p.featured).slice(0,4);

  return (
    <>
      <a className="skip-link" href="#about">
        Skip to content
      </a>
      <StudioMotion />
      <main>
        <Hero />
        <div className="studio-sections">
          {projects.length>0&&<ScrollReveal><section className="studio-panel client-strip"><span className="eyebrow">Built together</span><div>{[...new Set(projects.map(p=>String(p.client_name)).filter(Boolean))].slice(0,6).map(name=><span key={name}>{name}</span>)}</div></section></ScrollReveal>}
          <ScrollReveal><About /></ScrollReveal>
          <Services />
          <section id="works" className="studio-panel light-panel">
            <div className="section-heading"><h2>Thought through.<br/><span className="muted-heading">Brought to life.</span></h2><Link className="text-link" href="/projects">All work ↗</Link></div>
            {featured.length ? <div className="work-grid">{featured.map(row=><ProjectCard row={row} key={row.id}/>)}</div> : <div className="home-work-intro"><Copy text={await pageCopy('home','work','From a clear brand identity to a product ready for its first users, we bring design and development into one considered process. Tell us what you have in mind, and we’ll share relevant work.')}/><Link className="studio-button black-button" href="/services#inquiry">Discuss your project ↗</Link></div>}
          </section>
          <Process />
          <section className="studio-panel light-panel"><div className="section-heading"><h2>A little more<br/><span className="muted-heading">thought in every step.</span></h2><span className="eyebrow">Why Zaane</span></div><div className="four-column">{[['One connected team','Design and development working toward the same outcome.'],['Clear communication','A shared scope, agreed milestones and regular feedback.'],['Made for your users','Decisions grounded in the people and problems that matter.'],['Built to keep going','Considered handover and options for ongoing support.']].map(([a,b])=><article key={a}><h3>{a}</h3><p>{b}</p></article>)}</div></section>
          <Partnership />
          <section className="studio-panel light-panel"><div className="section-heading"><h2>In their words.</h2><Link href="/testimonials" className="text-link">Client stories ↗</Link></div><Testimonials rows={quotes.slice(0,3)}/></section>
          <Pricing />
          <Questions />
          <Contact />
        </div>
      </main>
      <Footer />
    </>
  );
}
