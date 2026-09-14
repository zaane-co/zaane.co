"use client";
import { useState } from "react";
import { ArrowUpRight, Check, Asterisk } from "lucide-react";
const services = [
  {
    title: "Custom software",
    symbol: "{ }",
    description: "Built around the way your business works.",
    items: [
      "Web platforms & dashboards",
      "APIs & integrations",
      "Internal tools",
      "Workflow automation",
    ],
  },
  {
    title: "Mobile & web apps",
    symbol: "↗",
    description: "Your next idea. In your customers’ hands.",
    items: [
      "iOS & Android",
      "Cross-platform builds",
      "Customer experiences",
      "Launch & iteration",
    ],
  },
  {
    title: "Product design",
    symbol: "✳",
    description: "Thoughtful from the first tap to the last detail.",
    items: [
      "User experience",
      "Interface design",
      "Design systems",
      "Interactive prototypes",
    ],
  },
  {
    title: "Business systems",
    symbol: "⌘",
    description: "Make the moving parts work together.",
    items: [
      "Technical strategy",
      "Connected operations",
      "Process improvement",
      "Ongoing support",
    ],
  },
];
export default function Services() {
  const [open, setOpen] = useState<number | null>(2);
  return (
    <section id="services" className="studio-panel dark-panel" data-reveal>
      <div className="section-heading">
        <h2>Services</h2>
        <div className="service-stars" aria-hidden="true">
          <Asterisk />
          <Asterisk />
          <Asterisk />
        </div>
        <span className="eyebrow">04 disciplines</span>
      </div>
      <div className="service-accordion">
        {services.map((s, i) => (
          <article
            key={s.title}
            className={`service-row ${open === i ? "is-open" : ""}`}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`service-detail-${i}`}
                id={`service-toggle-${i}`}
              >
                <span className="row-number">(0{i + 1})</span>
                <span>{s.title}</span>
                <span className="round-arrow">
                  <ArrowUpRight size={21} />
                </span>
              </button>
            </h3>
            <div
              id={`service-detail-${i}`}
              role="region"
              aria-labelledby={`service-toggle-${i}`}
              className="accordion-body"
              inert={open !== i}
              aria-hidden={open !== i}
            >
              <div>
                <div className="service-detail">
                  <p>{s.description}</p>
                  <div
                    className={`service-art service-art-${i}`}
                    aria-hidden="true"
                  >
                    <span>{s.symbol}</span>
                    <i />
                    <i />
                  </div>
                  <ul>
                    {s.items.map((item) => (
                      <li key={item}>
                        <Check size={15} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
