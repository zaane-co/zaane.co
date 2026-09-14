import { ArrowUpRight } from "lucide-react";
export default function Footer() {
  return (
    <footer className="studio-footer">
      <div className="footer-top">
        <p>
          Independent minds.
          <br />
          Extraordinary possibilities.
        </p>
        <nav aria-label="Footer navigation">
          <a href="#about">About</a>
          <a href="#services">Services</a>
          <a href="#works">Works</a>
          <a href="#contact">Contact</a>
        </nav>
        <a href="#top" className="back-top">
          Back to top <ArrowUpRight size={20} />
        </a>
      </div>
      <a href="#top" className="footer-wordmark" aria-label="Zaane home">
        Zaane
      </a>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Zaane. All rights reserved.</span>
        <span>Software. Apps. Business systems.</span>
        <a href="mailto:hello@zaane.co">Let’s create what’s next ↗</a>
      </div>
    </footer>
  );
}
