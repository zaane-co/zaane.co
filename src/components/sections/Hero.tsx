"use client";

import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import GradientWaves from "@/components/GradientWaves";
import ClientLogosArc from "@/components/ClientLogosArc";

import { ArrowRight } from "lucide-react";
import styles from "./Hero.module.css";

export default function Hero() {
  // The entrance animations below (pill, headline lines, subhead, CTAs) are
  // held paused until the preloader tells us its curtain is opening, so
  // they play while actually visible instead of finishing behind it. If the
  // preloader isn't mounted at all (e.g. currently disabled), reveal right
  // away instead of waiting on an event that will never come.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!document.querySelector("[data-preloader]")) {
      setRevealed(true);
      return;
    }
    const reveal = () => setRevealed(true);
    window.addEventListener("preloader:reveal", reveal);
    const fallback = setTimeout(reveal, 2600);
    return () => {
      window.removeEventListener("preloader:reveal", reveal);
      clearTimeout(fallback);
    };
  }, []);

  return (
    <section
      id="top"
      className={styles.section}
      aria-label="Zaane software studio"
    >
      <div className={styles.hero}>
        <div className={styles.heroHeader}>
          <SiteHeader variant="dark" />
        </div>
        <div className={styles.atmosphere} aria-hidden="true">
          <GradientWaves
            horizonColor="#0a0507"
            waveColor="#f10c45"
            crestColor="#ff3d66"
            speed={0.35}
            amplitude={2.2}
            waveScale={0.55}
            swell={30}
            turbulence={16}
            tilt={1.15}
            zoom={1.05}
            height={5}
            fogDepth={17}
            detail="medium"
            brightness={1.05}
            mouseInteraction
            parallaxStrength={0.4}
            grain={false}
          />
        </div>
        <svg
          className={styles.grain}
          aria-hidden="true"
          width="100%"
          height="100%"
        >
          <filter id="hero-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect
            width="100%"
            height="100%"
            filter="url(#hero-grain)"
            opacity="0.24"
          />
        </svg>

        <div
          className={`${styles.center} ${revealed ? "" : styles.held}`}
        >
          <div className={styles.socialProof}>
            <div className={styles.avatarStack}>
              <span className={styles.avatar}>
                <img src="/animated img/Ellipse 9.png" alt="" />
              </span>
              <span className={styles.avatar}>
                <img src="/animated img/Ellipse 10.png" alt="" />
              </span>
              <span className={styles.avatar}>
                <img src="/animated img/Ellipse 11.png" alt="" />
              </span>
            </div>
            <span className={styles.socialProofText}>200+ products shipped</span>
          </div>
          <h1 className={styles.headline}>
            <span className={styles.lineMask}>
              <span
                className={styles.line}
                style={{ animationDelay: "0.22s" }}
              >
                Built to Turn Ideas Into MVPs.
              </span>
            </span>
            <span className={styles.lineMask}>
              <span
                className={styles.line}
                style={{ animationDelay: "0.36s" }}
              >
                Designs Into Products.
              </span>
            </span>
          </h1>
          <p className={styles.subhead}>
            We combine creative design and technology to transform ideas
            into thoughtful brands, digital products, and functional MVPs
            <br />
            built to launch, validate, and grow.
          </p>
          <div className={styles.ctaRow}>
            <a className={styles.primaryCta} href="/services#inquiry">
              Let&apos;s Build It
            </a>
            <a className={styles.secondaryCta} href="/projects">
              See Our Work
              <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
            </a>
          </div>
        </div>
        <ClientLogosArc />
      </div>
    </section>
  );
}
