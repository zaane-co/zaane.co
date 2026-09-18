"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./ServiceCarousel.module.css";

const offerings = [
  {
    label: "Service 01",
    title: "Custom Software",
    description:
      "Built around the way your business works. From internal tools to full platforms, we build software that fits your workflow instead of forcing you to fit someone else's.",
    price: "$3,500",
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6",
  },
  {
    label: "Service 02",
    title: "Mobile & Web Apps",
    description:
      "Your next idea, in your customers' hands. iOS, Android, and cross-platform builds designed for real people to actually use.",
    price: "$4,000",
    image: "https://images.unsplash.com/photo-1551650975-87deedd944c3",
  },
  {
    label: "Service 03",
    title: "Product Design",
    description:
      "Thoughtful from the first tap to the last detail. User experience, interface design, and systems that hold up as you grow.",
    price: "$2,500",
    image: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e",
  },
  {
    label: "Service 04",
    title: "Business Systems",
    description:
      "Make the moving parts work together. Technical strategy, connected operations, and support that keeps things running.",
    price: "$3,000",
    image: "https://images.unsplash.com/photo-1611224923853-80b023f02d71",
  },
];

export default function ServiceCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = (i: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const clamped = (i + offerings.length) % offerings.length;
    const card = viewport.children[clamped] as HTMLElement;
    card?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  // Keep `active` (used for the dots) in sync with manual swipes/drags too,
  // not just arrow clicks — whichever card sits nearest centre wins.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = viewport.scrollLeft + viewport.clientWidth / 2;
        let closest = 0;
        let closestDist = Infinity;
        Array.from(viewport.children).forEach((child, i) => {
          const el = child as HTMLElement;
          const elCenter = el.offsetLeft + el.offsetWidth / 2;
          const dist = Math.abs(elCenter - center);
          if (dist < closestDist) {
            closestDist = dist;
            closest = i;
          }
        });
        setActive(closest);
      });
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.viewport} ref={viewportRef}>
        {offerings.map((o, i) => (
          <article
            key={o.title}
            className={styles.card}
            data-position={i === active ? "active" : i < active ? "prev" : "next"}
          >
            <div className={styles.copy}>
              <span className={styles.eyebrow}>What we offer</span>
              <h3>{o.title}</h3>
              <p>{o.description}</p>
              <div className={styles.priceBlock}>
                <span>Starting at</span>
                <strong>{o.price}</strong>
              </div>
            </div>
            <div className={styles.imageWrap}>
              <img src={`${o.image}?w=900&auto=format&fit=crop`} alt="" />
              <span className={styles.tag}>{o.label}</span>
              <span className={styles.grain} aria-hidden="true" />
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft}`}
        onClick={() => goTo(active - 1)}
        aria-label="Previous service"
      >
        <ArrowLeft size={18} />
      </button>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight}`}
        onClick={() => goTo(active + 1)}
        aria-label="Next service"
      >
        <ArrowRight size={18} />
      </button>
      <div className={styles.dots}>
        {offerings.map((o, i) => (
          <button
            key={o.title}
            type="button"
            className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Go to ${o.title}`}
          />
        ))}
      </div>
    </div>
  );
}
