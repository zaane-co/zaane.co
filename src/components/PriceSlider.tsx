"use client";

import { useEffect, useRef, useState } from "react";

const START_VALUE = 500;
const END_VALUE = 2500;
const END_FILL = 70;
const DURATION = 1100;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function PriceSlider() {
  const ref = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useState(false);
  const [value, setValue] = useState(START_VALUE);
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played) {
          setPlayed(true);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [played]);

  useEffect(() => {
    if (!played) return;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = easeOutCubic(t);
      setValue(Math.round(START_VALUE + (END_VALUE - START_VALUE) * eased));
      setFill(END_FILL * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [played]);

  return (
    <div className="benefits-card-price" ref={ref}>
      <span className="benefits-card-price-label">Starting from</span>
      <span className="benefits-card-price-value">
        ${value.toLocaleString()}
      </span>
      <div className="benefits-card-slider">
        <span style={{ width: `${fill}%` }} />
      </div>
      <div className="benefits-card-slider-labels">
        <span>Start simple</span>
        <span>Expand as you go</span>
      </div>
    </div>
  );
}
