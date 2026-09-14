"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
const questions = [
  [
    "What services do you offer?",
    "We design and build custom software, mobile and web apps, and business systems. We can help with product strategy, UX and interface design, development, integrations, and ongoing improvements.",
  ],
  [
    "How long does a typical project take?",
    "It depends on the scope, complexity, and what you already have in place. We define a realistic timeline during discovery and agree on milestones before development begins.",
  ],
  [
    "Do you offer support after project completion?",
    "Yes. We can agree on ongoing support, maintenance, and product improvements around the needs of your team. We discuss that plan before launch so you know what comes next.",
  ],
  [
    "Can you work with startups and small businesses?",
    "Absolutely. We help founders and small teams identify the most useful first version, focus the scope, and build a foundation that can grow with the business.",
  ],
  [
    "How do you price your services?",
    "We scope each engagement individually. Share your goals, priorities, and budget, and we’ll propose an approach with clear deliverables and costs before you commit.",
  ],
];
export default function Questions() {
  const [open, setOpen] = useState<number | null>(1);
  return (
    <section id="questions" className="studio-panel light-panel" data-reveal>
      <div className="section-heading">
        <h2>Questions</h2>
        <span className="eyebrow">FAQ</span>
      </div>
      <div className="faq-list">
        {questions.map(([question, answer], i) => (
          <article
            key={question}
            className={`faq-row ${open === i ? "is-open" : ""}`}
          >
            <h3>
              <button
                type="button"
                id={`question-${i}`}
                aria-expanded={open === i}
                aria-controls={`answer-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="row-number">0{i + 1}.</span>
                <span>{question}</span>
                <Plus size={20} />
              </button>
            </h3>
            <div
              className="accordion-body"
              id={`answer-${i}`}
              role="region"
              aria-labelledby={`question-${i}`}
              inert={open !== i}
              aria-hidden={open !== i}
            >
              <div>
                <p>{answer}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
