import Footer from "@/components/Footer";
import StudioMotion from "@/components/StudioMotion";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Services from "@/components/sections/Services";
import Works from "@/components/sections/Works";
import Process from "@/components/sections/Process";
import Partnership from "@/components/sections/Partnership";
import Pricing from "@/components/sections/Pricing";
import Questions from "@/components/sections/Questions";
import Contact from "@/components/sections/Contact";
export default function Home() {
  return (
    <>
      <a className="skip-link" href="#about">
        Skip to content
      </a>
      <StudioMotion />
      <main>
        <Hero />
        <div className="studio-sections">
          <About />
          <Services />
          <Works />
          <Process />
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
