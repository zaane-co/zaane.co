"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import styles from "./ScrollFillText.module.css";

type Props = {
  text: string;
  className?: string;
};

// Splits text into words and "fills" them in reading order (so it flows
// naturally across wrapped lines) as the element scrolls up through a band
// of the viewport, synced to Lenis's smooth-scroll frame.
export default function ScrollFillText({ text, className }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [progress, setProgress] = useState(0);
  const words = text.split(" ");

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const startLine = vh * 0.92; // top crosses here: fill starts
    const endLine = vh * 0.32; // bottom crosses here: fully filled
    const total = startLine - endLine + rect.height;
    const progressed = startLine - rect.top;
    const p = Math.min(1, Math.max(0, total > 0 ? progressed / total : 0));
    setProgress(p);
  };

  useLenis(() => update());

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filledCount = Math.round(progress * words.length);

  return (
    <h2 ref={ref} className={className}>
      {words.map((word, i) => (
        <span
          key={i}
          className={i < filledCount ? styles.filled : styles.dim}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </h2>
  );
}
