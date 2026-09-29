"use client";
import { useEffect, useState } from "react";
import { Code2, LayoutGrid, Minus, Palette, Plus, Rocket, Smartphone } from "lucide-react";

const details = [
  {
    title: "Graphics & Brand Design",
    icon: Palette,
    description:
      "Visual identities, graphic systems and brand assets that make you recognisable.",
    tags: ["Logo design", "Visual identity", "Brand guidelines", "Packaging", "Art direction"],
  },
  {
    title: "UI/UX Design",
    icon: LayoutGrid,
    description:
      "Research, user journeys, interfaces and prototypes built around the people using them.",
    tags: ["User research", "Wireframes", "Prototyping", "Design systems", "Usability testing"],
  },
  {
    title: "Web Development",
    icon: Code2,
    description:
      "Responsive websites and web platforms with considered design and reliable foundations.",
    tags: ["Responsive builds", "CMS integration", "Performance", "Accessibility", "SEO foundations"],
  },
  {
    title: "App Development",
    icon: Smartphone,
    description:
      "Mobile experiences designed and developed for the way your customers move.",
    tags: ["iOS & Android", "Cross-platform", "API integration", "App store launch"],
  },
  {
    title: "MVP Development",
    icon: Rocket,
    description:
      "A focused first product: the essential journey, a clear scope and a foundation to build on.",
    tags: ["Rapid prototyping", "Feature scoping", "Technical architecture", "Launch support"],
  },
];

export default function Services() {
  const rows = details;
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) {
      setOpen(0);
    }
  }, []);

  return (
    <section id="services" className="studio-panel dark-panel services-timeline" data-reveal>
      <div className="services-heading">
        <h2 className="services-heading-title">Services</h2>
      </div>

      <div className="services-rows">
        {rows.map((s, i) => {
          const Icon = s.icon;
          const isOpen = open === i;
          return (
            <article
              key={s.title}
              className={`services-row ${isOpen ? "is-open" : ""}`}
              onMouseEnter={() => setOpen(i)}
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  onFocus={() => setOpen(i)}
                  aria-expanded={isOpen}
                  aria-controls={`services-detail-${i}`}
                  id={`services-toggle-${i}`}
                >
                  <span className="services-row-media">
                    <Icon size={22} strokeWidth={1.6} />
                  </span>
                  <span className="services-row-title">{s.title}</span>
                  <span className="round-arrow services-row-toggle" aria-hidden="true">
                    {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                  </span>
                </button>
              </h3>
              <div
                id={`services-detail-${i}`}
                role="region"
                aria-labelledby={`services-toggle-${i}`}
                className="accordion-body"
                inert={!isOpen}
                aria-hidden={!isOpen}
              >
                <div>
                  <div className="services-row-inner">
                    <p className="process-row-detail">{s.description}</p>
                    <div className="services-categories">
                      <span className="services-categories-label">Categories</span>
                      <div className="services-tags">
                        {s.tags.map((tag) => (
                          <span className="service-tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
