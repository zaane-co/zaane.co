"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { X } from "lucide-react";

type Project = {
  name: string;
  links: string[];
  cta: string;
  headline: string;
  sub?: string;
  art: string;
  image?: string;
  theme: Record<string, string>;
};

// Replace `image` on any entry to swap in a real screenshot for that project.
const PROJECTS: Project[] = [
  {
    name: "civitas",
    links: ["Solutions", "Industries", "Case Studies", "Blog", "About"],
    cta: "Request a Demo",
    headline: "Sell your software to the government.",
    sub: "Simpler procurement. Bigger opportunities.",
    art: "prism",
    theme: {
      "--card-bg": "#f26a1f",
      "--card-fg": "#17110c",
      "--card-muted": "#7a4a22",
      "--card-cta-bg": "#14100c",
      "--card-cta-fg": "#ffffff",
    },
  },
  {
    name: "WAVE SYSTEMS",
    links: ["Solutions", "Industries", "Resources", "About"],
    cta: "Contact Us",
    headline: "We use AI to build a smarter grid.",
    art: "glow",
    theme: {
      "--card-bg": "#0b1714",
      "--card-fg": "#ffffff",
      "--card-muted": "#7f948d",
      "--card-cta-bg": "#43d5b0",
      "--card-cta-fg": "#062018",
    },
  },
  {
    name: "HSE",
    links: ["Technology", "Applications", "Company", "Careers"],
    cta: "Contact",
    headline: "Scaling chips down to their physical limits.",
    sub: "Fifteen times faster than the previous node.",
    art: "chip",
    theme: {
      "--card-bg": "#f2f2f0",
      "--card-fg": "#101114",
      "--card-muted": "#6b6d73",
      "--card-cta-bg": "#101114",
      "--card-cta-fg": "#ffffff",
    },
  },
  {
    name: "SOUNDFLOW",
    links: ["Products", "Use Cases", "Pricing", "Support"],
    cta: "Get Started",
    headline: "Modular sound, bold design.",
    art: "disc",
    theme: {
      "--card-bg": "#111113",
      "--card-fg": "#ffffff",
      "--card-muted": "#8c8c93",
      "--card-cta-bg": "#e0242b",
      "--card-cta-fg": "#ffffff",
    },
  },
  {
    name: "COMSIC",
    links: ["Products", "Developers", "Pricing", "Sign in"],
    cta: "Get Started",
    headline: "Build without limits.",
    art: "blocks",
    theme: {
      "--card-bg": "#b7a0f7",
      "--card-fg": "#1e1145",
      "--card-muted": "#4a3a7d",
      "--card-cta-bg": "#14101f",
      "--card-cta-fg": "#ffffff",
    },
  },
  {
    name: "BrightPath",
    links: ["Home", "About", "Services", "Blog", "Contact"],
    cta: "Talk to Us",
    headline: "Get a structured path to steady growth.",
    sub: "Planning, onboarding and reporting in one place.",
    art: "panel",
    theme: {
      "--card-bg": "#ffffff",
      "--card-fg": "#14161a",
      "--card-muted": "#6f7480",
      "--card-cta-bg": "#f5871f",
      "--card-cta-fg": "#ffffff",
    },
  },
  {
    name: "VANTAGE",
    links: ["Products", "Solutions", "Pricing", "Resources"],
    cta: "Get Started",
    headline: "Infrastructure for teams that ship.",
    art: "sweep",
    theme: {
      "--card-bg": "#0e1013",
      "--card-fg": "#ffffff",
      "--card-muted": "#8b909a",
      "--card-cta-bg": "#ffffff",
      "--card-cta-fg": "#0e1013",
    },
  },
];

const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

/**
 * The seven cards sit stacked directly on one another (--i / --wstack-count
 * drive the CSS overlap). Hovering a card lifts it forward; clicking one
 * expands it to fill the screen, animated as a FLIP transition (measure the
 * card's current rect, let it lay out full-screen, then play the delta
 * between the two as a transform) so it visibly grows from its spot in the
 * pile rather than just appearing.
 */
export default function WorkStack() {
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const flip = useRef<{ index: number; from: DOMRect } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const lenis = useLenis();

  const openCard = (i: number) => {
    if (expanded !== null) return;
    const el = cardRefs.current[i];
    if (!el) return;
    flip.current = { index: i, from: el.getBoundingClientRect() };
    setExpanded(i);
  };

  const closeCard = () => {
    if (expanded === null) return;
    const el = cardRefs.current[expanded];
    if (el) flip.current = { index: expanded, from: el.getBoundingClientRect() };
    setExpanded(null);
  };

  // Plays the FLIP transition after either an open or a close has just
  // changed the card's layout (stacked <-> full-screen). Runs before paint,
  // so the viewer never sees the card in its final spot before the animation
  // starts.
  useLayoutEffect(() => {
    const pending = flip.current;
    if (!pending) return;
    flip.current = null;

    const el = cardRefs.current[pending.index];
    if (!el) return;

    // Respect the OS preference: cards still open and close, just without
    // the animated grow/shrink in between.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const to = el.getBoundingClientRect();
    const dx = pending.from.left + pending.from.width / 2 - (to.left + to.width / 2);
    const dy = pending.from.top + pending.from.height / 2 - (to.top + to.height / 2);
    const sx = pending.from.width / to.width;
    const sy = pending.from.height / to.height;

    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.getBoundingClientRect(); // force reflow so the line above takes effect

    requestAnimationFrame(() => {
      el.style.transition = `transform 0.5s ${EASE}`;
      el.style.transform = "";
    });
    const clear = () => {
      el.style.transition = "";
    };
    el.addEventListener("transitionend", clear, { once: true });
    return () => el.removeEventListener("transitionend", clear);
  }, [expanded]);

  // Pause page scroll while a card is open, and let Escape close it.
  useEffect(() => {
    if (expanded === null) return;
    const previousOverflow = document.body.style.overflow;
    lenis?.stop();
    // The compiler-derived lint rule can't verify purity through the
    // `closeCard` reference below (it calls a state setter) and flags this
    // otherwise-ordinary scroll lock as a result. Same pattern, unflagged,
    // in Preloader.tsx, which has no such reference in its effect.
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCard();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <section
      id="our-work"
      className="wstack"
      aria-labelledby="wstack-title"
      style={{ "--wstack-count": PROJECTS.length } as React.CSSProperties}
    >
      <div className="wstack-intro">
        <h2 id="wstack-title">Our work</h2>
      </div>
      <div
        className={`wstack-backdrop ${expanded !== null ? "is-visible" : ""}`}
        aria-hidden="true"
        onClick={closeCard}
      />
      <div className="wstack-box">
        {PROJECTS.map((project, i) => (
          <article
            key={project.name}
            className={`wstack-card ${expanded === i ? "is-expanded" : ""}`}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            style={{ ...project.theme, "--i": i } as React.CSSProperties}
            onClick={() => openCard(i)}
            role="button"
            tabIndex={0}
            aria-expanded={expanded === i}
            aria-label={`Open ${project.name}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCard(i);
              }
            }}
          >
            {expanded === i && (
              <button
                type="button"
                className="wstack-close"
                aria-label="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeCard();
                }}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            )}
            {project.image ? (
              <img
                className="wstack-shot"
                src={project.image}
                alt={project.name}
                loading="lazy"
              />
            ) : (
              <div className="wstack-site">
                <header className="wstack-site-nav">
                  <span className="wstack-site-logo">{project.name}</span>
                  <span className="wstack-site-links" aria-hidden="true">
                    {project.links.map((link) => (
                      <span key={link}>{link}</span>
                    ))}
                  </span>
                  <span className="wstack-site-cta" aria-hidden="true">
                    {project.cta}
                  </span>
                </header>
                <div className="wstack-site-hero">
                  <div className="wstack-site-copy">
                    <h3>{project.headline}</h3>
                    {project.sub && <p>{project.sub}</p>}
                  </div>
                  <div
                    className={`wstack-art wstack-art-${project.art}`}
                    aria-hidden="true"
                  >
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
