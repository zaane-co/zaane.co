"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

const steps = [
  {
    title: "Discovery",
    duration: "1–2 weeks",
    description:
      "We get close to your business, your users, and what success looks like, auditing what exists, mapping requirements, and agreeing the constraints that matter.",
  },
  {
    title: "Strategy",
    duration: "1 week",
    description:
      "We turn discovery into a shared plan: scope, technical approach, and a roadmap with milestones you can hold us to.",
  },
  {
    title: "Design",
    duration: "2–3 weeks",
    description:
      "We map the journeys, shape the experience, and prototype the details before a single line of production code is written.",
  },
  {
    title: "Development",
    duration: "3–5 weeks",
    description:
      "Short cycles, open conversations, and working software throughout. You stay involved as your product takes shape.",
  },
  {
    title: "Launch",
    duration: "1 week",
    description:
      "We get you live, support the handover, and stay close. This is the beginning of what's next, not the end of the engagement.",
  },
];

export default function Process() {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) {
      setOpen(0);
    }
  }, []);

  return (
    <section
      id="process"
      className="studio-panel dark-panel process-timeline"
      data-reveal
    >
      <div className="section-heading process-timeline-heading">
        <h2>
          A refined process
          <br />
          <span className="muted-heading">built on clarity.</span>
        </h2>
        <a
          href="#contact"
          className="studio-button orange-button process-timeline-cta process-timeline-cta-top"
        >
          Talk to us
          <ArrowUpRight size={19} />
        </a>
      </div>
      <div className="process-rows">
        {steps.map((s, i) => (
          <article
            key={s.title}
            className={`process-row ${open === i ? "is-open" : ""}`}
            onMouseEnter={() => setOpen(i)}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpen(i)}
                onFocus={() => setOpen(i)}
                aria-expanded={open === i}
                aria-controls={`process-detail-${i}`}
                id={`process-toggle-${i}`}
              >
                <span className="row-number">00{i + 1}</span>
                <span>{s.title}</span>
                <span className="process-row-duration">{s.duration}</span>
              </button>
            </h3>
            <div
              id={`process-detail-${i}`}
              role="region"
              aria-labelledby={`process-toggle-${i}`}
              className="accordion-body"
              inert={open !== i}
              aria-hidden={open !== i}
            >
              <div>
                <p className="process-row-detail">{s.description}</p>
              </div>
            </div>
          </article>
        ))}
        <a
          href="#contact"
          className="studio-button orange-button process-timeline-cta process-timeline-cta-bottom"
        >
          Talk to us
          <ArrowUpRight size={19} />
        </a>
      </div>
    </section>
  );
}
