import { ArrowUpRight, Check } from "lucide-react";
export default function Pricing() {
  return (
    <section
      id="pricing"
      className="studio-panel dark-panel pricing-panel"
      data-reveal
    >
      <div className="section-heading">
        <h2>
          The right fit.
          <br />
          From the start.
        </h2>
        <span className="eyebrow">Working together</span>
      </div>
      <p className="section-intro">
        A focused project or an ongoing partnership. We scope the work around
        your goals, then agree on the investment together.
      </p>
      <div className="pricing-grid">
        <article className="pricing-card">
          <span className="pricing-label">01 / PROJECT</span>
          <h3>Build something new.</h3>
          <p>For a defined product, platform, or next big release.</p>
          <strong className="price">Scoped to your project</strong>
          <a href="#contact" className="studio-button black-button">
            Discuss your project
            <ArrowUpRight size={19} />
          </a>
          <ul>
            {[
              "Discovery & a clear scope",
              "Product design & development",
              "Agreed milestones & deliverables",
              "Launch planning & handover",
            ].map((x) => (
              <li key={x}>
                <Check size={16} />
                {x}
              </li>
            ))}
          </ul>
        </article>
        <article className="pricing-card ongoing-card">
          <span className="pricing-label">02 / PARTNERSHIP</span>
          <h3>Keep moving forward.</h3>
          <p>For teams who need a product partner alongside them.</p>
          <strong className="price">Tailored ongoing support</strong>
          <a href="#contact" className="studio-button orange-button">
            Let’s work together
            <ArrowUpRight size={19} />
          </a>
          <ul>
            {[
              "A shared product roadmap",
              "Design & engineering support",
              "Continuous product improvements",
              "Regular planning & progress reviews",
            ].map((x) => (
              <li key={x}>
                <Check size={16} />
                {x}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
