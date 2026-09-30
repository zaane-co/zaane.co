import Footer from "@/components/Footer";
import StudioMotion from "@/components/StudioMotion";
import ScrollReveal from "@/components/ScrollReveal";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Process from "@/components/sections/Process";
import WorkGallery from "@/components/sections/WorkGallery";
import Services from "@/components/sections/Services";
import Testimonials from "@/components/sections/Testimonials";
import Pricing from "@/components/sections/Pricing";
import Questions from "@/components/sections/Questions";
import Contact from "@/components/sections/Contact";
import { records } from "@/lib/content";
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
          <Testimonials rows={quotes} />
          <Pricing />
          <Questions />
          <Contact />
        </div>
      </main>
      <Footer />
    </>
  );
}
