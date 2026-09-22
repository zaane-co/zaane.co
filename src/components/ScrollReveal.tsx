"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLenis } from "lenis/react";

type Props = {
  children: ReactNode;
  className?: string;
};

// Continuously ties opacity/translate/scale to how far the element has
// scrolled into view, instead of firing a single canned transition once.
// The section feels physically connected to the scroll gesture itself.
export default function ScrollReveal({ children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const startLine = vh * 0.95; // top crosses here: reveal starts
    const endLine = vh * 0.6; // top crosses here: fully revealed
    const p = Math.min(
      1,
      Math.max(0, (startLine - rect.top) / (startLine - endLine))
    );
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

  const style: CSSProperties = {
    opacity: progress,
    transform: `translateY(${(1 - progress) * 46}px) scale(${0.97 + progress * 0.03})`,
  };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
