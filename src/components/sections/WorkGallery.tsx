"use client";

import { useEffect, useState } from "react";
import FlexCarousel from "@/components/FlexCarousel";

export default function WorkGallery() {
  // The mobile frame (.work-gallery-frame) is shorter in absolute pixels, so
  // the same fraction-of-height card leaves less room for the caption below
  // it. A lower fraction there keeps the caption from clipping; desktop's
  // taller frame can afford a much fuller card.
  const [cardHeight, setCardHeight] = useState(0.68);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 800px)");
    const apply = () => setCardHeight(query.matches ? 0.5 : 0.68);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <section id="our-work" className="wstack" aria-labelledby="wstack-title">
      <div className="wstack-intro">
        <h2 id="wstack-title">Featured work</h2>
        <p className="wstack-subhead">
          A look at the brands, products, and interfaces we&apos;ve shaped,
          each one built with intention, from first sketch to launch.
        </p>
      </div>
      <div className="work-gallery-frame">
        <FlexCarousel
          preset="liquid"
          intro="rise"
          cardHeight={cardHeight}
          gap={12}
          squeeze={0.2}
          focusOnClick
          captions
          fit="natural"
          radius={0}
          lensWidth={0.74}
          lensHeight={1.18}
          tilt={62}
          roundness={1}
          bend={0.34}
          reach={0.38}
          curl="twist"
          dispersion={0.45}
          liquid={0}
          followCursor={false}
          autoplay
          interval={4}
          captureWheel
        />
      </div>
    </section>
  );
}
