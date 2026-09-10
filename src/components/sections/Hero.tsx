"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Menu, Star, X } from "lucide-react";
import PillButton from "@/components/PillButton";
import BorderGlow from "@/components/BorderGlow";

const navLinks = [
  { href: "#services", label: "Services" },
  { href: "#process", label: "Process" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

const avatars = [
  {
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=faces&q=80",
    alt: "Portrait of a man",
  },
  {
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=faces&q=80",
    alt: "Portrait of a woman",
  },
  {
    src: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&h=160&fit=crop&crop=faces&q=80",
    alt: "Portrait of a man",
  },
  {
    src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&crop=faces&q=80",
    alt: "Portrait of a man",
  },
];

const stack = ["Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase"];

export default function Hero() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ids = navLinks.map((link) => link.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <section id="top">
      {/* Nav */}
      <div className="sticky top-0 z-50 border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <a href="#top" className="flex shrink-0 items-center">
            <Image
              src="/zaane-logo.svg"
              alt="Zaane"
              width={126}
              height={22}
              priority
              style={{ height: 20, width: "auto" }}
            />
          </a>

          <nav className="hidden items-center gap-1 rounded-full border border-border bg-surface p-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  active === link.href.slice(1)
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:block">
            <PillButton href="#contact">Start a project</PillButton>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {mobileOpen && (
          <nav className="border-t border-border px-6 py-4 lg:hidden">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-muted transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <PillButton href="#contact" className="mt-2 justify-center">
                Start a project
              </PillButton>
            </div>
          </nav>
        )}
      </div>

      {/* Hero content */}
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-14 pt-16 text-center sm:pb-20 sm:pt-24">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl sm:leading-tight">
          We build the software your business runs on
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Zaane is a software studio. We design and build custom software,
          mobile and web apps, and the business systems around them, from
          first sketch to a product your customers actually use.
        </p>

        <div className="mt-10 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <BorderGlow
            backgroundColor="#0a0a0d"
            borderRadius={999}
            glowRadius={18}
            glowIntensity={0.9}
            coneSpread={30}
            glowColor="234 90 70"
            colors={["#4c5eff", "#38bdf8", "#a78bfa"]}
            className="border-glow-card--light w-fit"
          >
            <a
              href="#contact"
              className="inline-flex items-center gap-3 py-1.5 pl-6 pr-1.5 text-base font-medium text-white"
            >
              Get Started
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-foreground">
                <ArrowUpRight size={18} />
              </span>
            </a>
          </BorderGlow>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-3">
              {avatars.map((avatar) => (
                <Image
                  key={avatar.src}
                  src={avatar.src}
                  alt={avatar.alt}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                Backed by senior product &amp; engineering talent
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stack strip */}
      <div className="border-y border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <p className="shrink-0 text-xs text-muted">Built with tools we trust</p>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {stack.map((name) => (
              <span key={name} className="text-lg font-semibold tracking-tight text-muted">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
