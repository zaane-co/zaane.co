"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLenis } from "lenis/react";
import { safeUrl } from "@/lib/cms";
import type { ContentRow } from "@/lib/content";

function Heading() {
  return (
    <div className="section-heading">
      <h2>In their words.</h2>
      <Link href="/testimonials" className="text-link">
        Client stories ↗
      </Link>
    </div>
  );
}

// Each card sits `SCROLL_PER_CARD` viewport-heights of scroll distance apart
// while the section stays pinned, so the deck advances one card per "turn"
// of scrolling rather than all at once.
const SCROLL_PER_CARD = 70;
const MAX_VISIBLE_BEHIND = 3;

function Card({ row }: { row: ContentRow }) {
  const photo = safeUrl(row.photo_url);
  return (
    <>
      <span className="stack-quote-mark" aria-hidden="true">
        ”
      </span>
      <blockquote>{String(row.quote)}</blockquote>
      <figcaption>
        <div>
          <strong>{String(row.client_name)}</strong>
          <p>{String(row.client_role)}</p>
        </div>
        {photo && <img src={photo} alt="" loading="lazy" />}
      </figcaption>
    </>
  );
}

export default function TestimonialStack({ rows }: { rows: ContentRow[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const count = rows.length;

  const update = () => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrollable = rect.height - vh;
    const scrolled = Math.min(Math.max(-rect.top, 0), scrollable);
    setProgress(scrollable > 0 ? (scrolled / scrollable) * (count - 1) : 0);
  };

  useLenis(() => count >= 2 && update());

  useEffect(() => {
    if (count < 2) return;
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (count === 0) {
    return (
      <section id="testimonials" className="studio-panel dark-panel testimonial-stack-section">
        <Heading />
        <div className="empty-state">
          <span className="empty-mark">”</span>
          <h3>The work comes first.</h3>
          <p>Client stories will be shared here as they&rsquo;re approved for publication.</p>
        </div>
      </section>
    );
  }

  if (count === 1) {
    return (
      <section id="testimonials" className="studio-panel dark-panel testimonial-stack-section">
        <Heading />
        <figure className="stack-card stack-card-static">
          <Card row={rows[0]} />
        </figure>
      </section>
    );
  }

  const front = Math.min(Math.floor(progress), count - 1);
  const fraction = progress - front;

  return (
    <section id="testimonials" className="studio-panel dark-panel testimonial-stack-section">
      <Heading />
      <div className="stack-track" ref={trackRef} style={{ height: `${(count - 1) * SCROLL_PER_CARD + 100}vh` }}>
        <div className="stack-sticky">
          {rows.map((row, i) => {
            const depth = i - front;
            const spin = i % 2 === 0 ? 1 : -1;
            let transform: string;
            let opacity: number;

            if (depth < 0) {
              opacity = 0;
              transform = `translateY(-70px) rotate(${-spin * 8}deg) scale(0.92)`;
            } else if (depth === 0) {
              opacity = 1 - fraction;
              transform = `translateY(${-60 * fraction}px) rotate(${spin * 6 * fraction}deg) scale(${1 - 0.05 * fraction})`;
            } else if (depth === 1) {
              opacity = 1;
              transform = `translateY(${28 * (1 - fraction)}px) rotate(${spin * 4 * (1 - fraction)}deg) scale(${0.96 + 0.04 * fraction})`;
            } else {
              const settled = Math.min(depth - 1, MAX_VISIBLE_BEHIND - 1);
              opacity = depth <= MAX_VISIBLE_BEHIND ? 1 : 0;
              transform = `translateY(${28 + settled * 14}px) rotate(${spin * 4}deg) scale(${0.96 - settled * 0.02})`;
            }

            return (
              <figure
                key={row.id}
                className="stack-card"
                style={{ transform, opacity, zIndex: count - i }}
              >
                <Card row={row} />
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
