"use client";

import { useEffect, useRef } from "react";

// A light that travels the full perimeter of the pill nav, rounded ends
// included. Drawn as an SVG stroke so the streak stays the same length all
// the way round; the old rotating gradient bar couldn't reach the far ends
// of such a wide pill, so it only ever lit the middle of the top and bottom.
export default function PillLight() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const rects = Array.from(svg.querySelectorAll("rect"));
    // Size the rect to the pill and round its ends to a true semicircle.
    const fit = () => {
      const { width, height } = svg.getBoundingClientRect();
      const w = Math.max(0, width - 2);
      const h = Math.max(0, height - 2);
      for (const rect of rects) {
        rect.setAttribute("width", String(w));
        rect.setAttribute("height", String(h));
        rect.setAttribute("rx", String(h / 2));
        rect.setAttribute("ry", String(h / 2));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={ref} className="pill-light" aria-hidden="true" focusable="false">
      <rect className="pill-light-glow" x="1" y="1" pathLength="100" />
      <rect className="pill-light-core" x="1" y="1" pathLength="100" />
    </svg>
  );
}
