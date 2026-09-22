"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

// Cards fade + step up into place once, when the row scrolls into view.
// Unlike StepCards, there's no continuous scroll-linked carousel motion.
export default function StepEntrance({ children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const items = Children.toArray(children);

  return (
    <div ref={ref} className={className}>
      {items.map((child, i) => (
        <div
          key={i}
          className="step-entrance-item"
          style={{
            transitionDelay: `${i * 130}ms`,
            opacity: visible ? 1 : 0,
            transform: visible
              ? "translateY(0)"
              : "translateY(56px)",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
