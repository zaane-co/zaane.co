"use client";

import {
  Children,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLenis } from "lenis/react";

type Props = {
  children: ReactNode;
  className?: string;
};

// Each child slides in from the right like a carousel, while also starting
// at a different vertical offset (a staircase) that resolves as it settles
// into the row. Combines a lateral entrance with a "step up and align" feel.
export default function StepCards({ children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const startLine = vh * 0.98;
    const endLine = vh * 0.1;
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

  const items = Children.toArray(children);
  const stagger = 0.14;

  return (
    <div ref={ref} className={className}>
      {items.map((child, i) => {
        const delay = i * stagger;
        const eased = Math.min(
          1,
          Math.max(0, (progress - delay) / (1 - delay))
        );
        const distance = 90 + i * 40;
        const step = 30 + i * 46;
        const style: CSSProperties = {
          opacity: eased,
          transform: `translate(${(1 - eased) * distance}px, ${
            (1 - eased) * step
          }px)`,
        };
        return (
          <div key={i} style={style}>
            {child}
          </div>
        );
      })}
    </div>
  );
}
