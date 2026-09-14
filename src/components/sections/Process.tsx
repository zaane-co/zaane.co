import { ArrowUpRight } from "lucide-react";
const steps = [
  [
    "Discover",
    "First, the right questions.",
    "We get close to your business, your customers, and what success looks like. Together, we define what’s worth building.",
  ],
  [
    "Design",
    "Make the idea tangible.",
    "We map the journeys, shape the experience, and prototype the details before we move into development.",
  ],
  [
    "Build",
    "Progress you can see.",
    "Short cycles, open conversations, and working software. You stay involved as your product takes shape.",
  ],
  [
    "Launch & evolve",
    "The beginning of what’s next.",
    "We get you live and stay close, supporting your team and improving the product as your business grows.",
  ],
];
export default function Process() {
  return (
    <section id="process" className="studio-panel light-panel" data-reveal>
      <div className="section-heading">
        <h2>
          From first idea.
          <br />
          <span className="muted-heading">To what’s next.</span>
        </h2>
        <span className="eyebrow">Our process</span>
      </div>
      <div className="process-grid">
        {steps.map(([title, subtitle, copy], i) => (
          <article
            className="process-step"
            key={title}
            data-reveal
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="step-top">
              <span>0{i + 1}</span>
              <ArrowUpRight size={24} />
            </div>
            <h3>{title}</h3>
            <h4>{subtitle}</h4>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
