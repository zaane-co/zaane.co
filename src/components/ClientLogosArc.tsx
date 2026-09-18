"use client";

import { useEffect, useRef } from "react";
import styles from "./ClientLogosArc.module.css";

const logos = [
  { file: "Frame 91.svg" },
  { file: "Frame 99.svg" },
  { file: "Frame 100.svg" },
  { file: "Frame 101.svg" },
  { file: "Frame 102.svg" },
  { file: "Frame 103.svg" },
  { file: "Frame 104.svg" },
  { file: "Frame 105.svg" },
  { file: "Frame 106.svg" },
  { file: "Frame 107.svg" },
  { file: "Frame 108.svg" },
  { file: "Frame 109.svg" },
  { file: "Frame 110.svg" },
];

// Three back-to-back copies so the strip always covers the viewport plus one
// full copy. Scrolling exactly one copy-width and snapping back is seamless.
const COPIES = 3;
const track = Array.from({ length: COPIES }, () => logos).flat();

// Seconds for the strip to travel one copy-width (one full loop).
const LOOP_SECONDS = 32;
// Height of the arc at the centre of the viewport. Each logo is lifted by
// how close it currently is to the centre, so the arc stays fixed in place
// while the logos ride along it.
const ARC_LIFT = 96;

export default function ClientLogosArc() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const trackEl = trackRef.current;
    if (!viewport || !trackEl) return;

    const slots = Array.from(trackEl.children) as HTMLElement[];
    let viewportWidth = 0;
    let copyWidth = 0;
    let slotWidth = 0;
    let lefts: number[] = [];
    let offset = 0;

    const measure = () => {
      viewportWidth = viewport.clientWidth;
      lefts = slots.map((slot) => slot.offsetLeft);
      slotWidth = slots[0]?.offsetWidth ?? 0;
      copyWidth = lefts[logos.length] - lefts[0];
    };

    const place = () => {
      if (!viewportWidth || !copyWidth) return;
      trackEl.style.transform = `translate3d(${-offset}px, 0, 0)`;
      // Keep the arc proportional on narrow screens.
      const maxLift = Math.min(ARC_LIFT, viewportWidth * 0.06);
      for (let i = 0; i < slots.length; i++) {
        const centre = lefts[i] - offset + slotWidth / 2;
        const u = centre / viewportWidth;
        let lift = 0;
        if (u > 0 && u < 1) {
          // -1 at the left edge, 0 at the centre, 1 at the right edge.
          const d = 2 * u - 1;
          // Parabola: flat across the top, dropping away at both edges.
          lift = maxLift * (1 - d * d);
        }
        slots[i].style.transform = `translateY(${-lift}px)`;
      }
    };

    measure();
    place();

    let raf = 0;
    let start: number | null = null;
    const frame = (now: number) => {
      if (start === null) start = now;
      const elapsed = (now - start) / 1000;
      offset = ((elapsed / LOOP_SECONDS) * copyWidth) % copyWidth;
      place();
      raf = requestAnimationFrame(frame);
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!reduceMotion.matches) raf = requestAnimationFrame(frame);

    const observer = new ResizeObserver(() => {
      measure();
      place();
    });
    observer.observe(viewport);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        style={{ paddingTop: ARC_LIFT + 12 }}
      >
        <div ref={trackRef} className={styles.track}>
          {track.map(({ file }, i) => (
            <span key={i} className={styles.slot}>
              <img
                className={styles.logo}
                src={`/client icons/${encodeURIComponent(file)}`}
                alt=""
              />
            </span>
          ))}
        </div>
      </div>
      <div className={styles.trustPill}>
        <div className={styles.flagStack}>
          <span className={styles.flag} aria-hidden="true">
            🇳🇬
          </span>
          <span className={styles.flag} aria-hidden="true">
            🇺🇸
          </span>
          <span className={styles.flag} aria-hidden="true">
            🇨🇦
          </span>
        </div>
        <span className={styles.trustText}>
          Trusted by brands across the world
        </span>
      </div>
    </div>
  );
}
