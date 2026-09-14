"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Asterisk } from "lucide-react";
const principles = [
  {
    title: "A product team. In your corner.",
    copy: "You work directly with the people designing and building your product. Clear conversations, shared decisions, and a team that cares about the outcome.",
    label: "Close collaboration",
    detail: "One team, from idea to launch.",
  },
  {
    title: "Less mystery. More momentum.",
    copy: "See your product take shape in short, visible cycles. We share progress early, talk through tradeoffs, and make room for what we learn along the way.",
    label: "Visible progress",
    detail: "Working software. Open communication.",
  },
  {
    title: "Built for life after launch.",
    copy: "Shipping is a milestone, not the finish line. We build with maintainability in mind and help you plan the support and improvements your product needs next.",
    label: "Long-term thinking",
    detail: "A strong foundation for what’s next.",
  },
];
export default function Partnership() {
  const [index, setIndex] = useState(0);
  const item = principles[index];
  return (
    <section
      className="studio-panel dark-panel"
      data-reveal
      aria-label="Working with Zaane"
    >
      <div className="section-heading">
        <h2>
          Good work starts
          <br />
          with a good partnership.
        </h2>
        <span className="eyebrow">The Zaane approach</span>
      </div>
      <div className="partnership-grid">
        <div className="partnership-art" aria-hidden="true">
          <Asterisk strokeWidth={0.65} />
          <span>
            YOUR AMBITION.
            <br />
            OUR SHARED PURPOSE.
          </span>
        </div>
        <div className="principle-card">
          <div key={index} className="principle-content" aria-live="polite">
            <span className="principle-stars" aria-hidden="true">
              ✳ ✳ ✳
            </span>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
            <div className="principle-author">
              <span className="mini-mark">z.</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </div>
            </div>
          </div>
          <div className="slider-controls">
            <span>
              0{index + 1} <span>/ 03</span>
            </span>
            <div>
              <button
                type="button"
                aria-label="Previous principle"
                onClick={() => setIndex((index + 2) % 3)}
              >
                <ArrowLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Next principle"
                onClick={() => setIndex((index + 1) % 3)}
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
