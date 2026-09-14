"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Menu, X } from "lucide-react";
import styles from "./Hero.module.css";

const navLinks = [
  { href: "#top", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#works", label: "Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#questions", label: "Questions" },
  { href: "#contact", label: "Contact" },
];
const services = [
  "Custom software",
  "Mobile & web apps",
  "Product design",
  "Business systems",
];

export default function Hero() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("top");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    navLinks.forEach(({ href }) => {
      const section = document.getElementById(href.slice(1));
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  return (
    <section
      id="top"
      className={styles.section}
      aria-label="Zaane software studio"
    >
      <header className={styles.header}>
        <a href="#top" aria-label="Zaane home" className={styles.logo}>
          <Image
            src="/zaane-logo.svg"
            alt="Zaane"
            width={126}
            height={22}
            priority
          />
        </a>
        <nav aria-label="Main navigation" className={styles.desktopNav}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={
                active === link.href.slice(1) ? "location" : undefined
              }
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a href="#contact" className={styles.headerCta}>
          Get Started
        </a>
        <button
          type="button"
          className={styles.menuToggle}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        {mobileOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className={styles.mobileNav}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a href="#contact" onClick={() => setMobileOpen(false)}>
              Get Started <ArrowRight size={18} />
            </a>
          </nav>
        )}
      </header>

      <div className={styles.hero}>
        <div className={styles.atmosphere} aria-hidden="true" />
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
        <div className={styles.topline}>
          <p className={styles.availability}>
            <span />
            Available for new projects
          </p>
          <p className={styles.description}>
            We design and build software,
            <br />
            apps, and business systems.
            <br />
            <span>From first idea to what’s next.</span>
          </p>
        </div>
        <div className={styles.bottomline}>
          <div className={styles.brand}>
            <p>
              <span>Zaane</span> turns your next big idea into
              <br />
              software people love to use.
            </p>
            <h1>
              Zaane
              <span className="sr-only">
                {" "}
                — Software, apps &amp; business systems
              </span>
            </h1>
          </div>
          <div className={styles.servicePanel}>
            <a className={styles.primaryCta} href="#contact">
              Get Started
            </a>
            <nav
              className={styles.serviceList}
              aria-label="Explore our services"
            >
              {services.map((service) => (
                <a href="#services" key={service}>
                  {service}
                  <ArrowRight size={19} strokeWidth={1.3} aria-hidden="true" />
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </section>
  );
}
