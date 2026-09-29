"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Handshake, Laptop, Ticket, Zap } from "lucide-react";
import ScrollFillText from "@/components/ScrollFillText";
import StepEntrance from "@/components/StepEntrance";
import PriceSlider from "@/components/PriceSlider";

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

      <div className="benefits-row">
        <span className="eyebrow icon-eyebrow">
          <Handshake size={16} strokeWidth={2} />
          Benefits
        </span>
        <div className="benefits-copy">
          <ScrollFillText
            className="about-heading"
            text="We focus on making your business stand out with work that's useful, flexible, and built for the long term."
          />
          <p className="benefits-text">
            Our clients come to us because they want more than good-looking
            visuals. They want design that solves problems, branding that
            resonates, and websites that actually perform.
          </p>
        </div>

        <StepEntrance className="benefits-cards">
          <div className="benefits-card">
            <span className="benefits-card-label">
              <Ticket size={16} strokeWidth={2} />
              Flexible pricing
            </span>
            <h3>Clear packages for different stages of growth.</h3>
            <PriceSlider />
          </div>

          <div className="benefits-card">
            <span className="benefits-card-label">
              <Laptop size={16} strokeWidth={2} />
              Priority support
            </span>
            <h3>Fast communication and quick turnaround on feedback.</h3>
            <div className="benefits-card-notif">
              <img
                src="/support3.png"
                alt=""
                className="benefits-card-support-img"
                loading="lazy"
              />
            </div>
          </div>

          <div className="benefits-card">
            <span className="benefits-card-label">
              <Zap size={16} strokeWidth={2} />
              Fast turnarounds
            </span>
            <h3>Clear timelines, every step of the way.</h3>
            <div className="benefits-card-time">
              <span className="benefits-card-time-label">
                Time to complete
              </span>
              <span className="benefits-card-time-value">14-21 days</span>
            </div>
            <div className="benefits-card-ruler" aria-hidden="true">
              <span className="benefits-card-ruler-accent" />
              <div className="benefits-card-ruler-track">
                {Array.from({ length: 2 }).map((_, dup) => (
                  <div className="benefits-card-ruler-set" key={dup}>
                    {Array.from({ length: 30 }).map((_, i) => {
                      const day = new Date();
                      day.setDate(day.getDate() + i - 15);
                      return (
                        <div className="benefits-card-ruler-tick" key={i}>
                          <span className="benefits-card-ruler-mark" />
                          {i % 4 === 0 && (
                            <span className="benefits-card-ruler-ticklabel">
                              {day.getDate()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </StepEntrance>
      </div>
    </section>
  );
}
