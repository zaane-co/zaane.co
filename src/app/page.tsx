import Footer from "@/components/Footer";
import StudioMotion from "@/components/StudioMotion";
import ScrollReveal from "@/components/ScrollReveal";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Process from "@/components/sections/Process";
import WorkGallery from "@/components/sections/WorkGallery";
import Services from "@/components/sections/Services";
import TestimonialStack from "@/components/sections/TestimonialStack";
import Partnership from "@/components/sections/Partnership";
import Pricing from "@/components/sections/Pricing";
import Questions from "@/components/sections/Questions";
import Contact from "@/components/sections/Contact";
import Link from "next/link";
import { records, pageCopy } from "@/lib/content";
import { ProjectCard, Copy } from "@/components/PageParts";
export default async function Home() {
  const [projects, quotes] = await Promise.all([records('projects'), records('testimonials')]);
  const featured = projects.filter(p=>p.featured).slice(0,4);
  const clientNames = [...new Set(projects.map(p=>String(p.client_name)).filter(Boolean))];

  return (
    <>
      <a className="skip-link" href="#about">
        Skip to content
      </a>
      <StudioMotion />
      <main>
        <Hero />
        <div className="studio-sections">
          {clientNames.length>0&&<ScrollReveal><section className="studio-panel client-strip"><span className="eyebrow">Built together</span><div>{clientNames.slice(0,6).map(name=><span key={name}>{name}</span>)}</div></section></ScrollReveal>}
          <ScrollReveal><About testimonial={quotes[0]} project={featured[0] || projects[0]} /></ScrollReveal>
          <Process />
          <WorkGallery />
          <Services />
          <TestimonialStack rows={quotes} />
          <section id="works" className="studio-panel dark-panel">
            <div className="section-heading"><h2>Thought through.<br/><span className="muted-heading">Brought to life.</span></h2><Link className="text-link" href="/projects">All work ↗</Link></div>
            {featured.length ? <div className="work-grid">{featured.map(row=><ProjectCard row={row} key={row.id}/>)}</div> : <div className="home-work-intro"><Copy text={await pageCopy('home','work','From a clear brand identity to a product ready for its first users, we bring design and development into one considered process. Tell us what you have in mind, and we’ll share relevant work.')}/><Link className="studio-button black-button" href="/services#inquiry">Discuss your project ↗</Link></div>}
          </section>
          <Partnership />
          <Pricing />
          <Questions />
          <Contact />
        </div>
      </main>
      <Footer />
    </>
  );
}
