"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Cta3DButton from "./Cta3DButton";
import BorderGlow from "./BorderGlow";
import PillLight from "./PillLight";

const links = [
  ["About", "/about"],
  ["Services", "/services"],
  ["Work", "/projects"],
  ["Journal", "/blog"],
  ["Pricing", "/pricing"],
];

export default function SiteHeader({ variant = "light" }: { variant?: "light" | "dark" }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={`site-header${variant === "dark" ? " site-header--dark" : ""}`}>
      <Link href="/" className="site-logo" aria-label="Zaane home">
        <img
          src={variant === "dark" ? "/zaane-logo-light.svg" : "/zaane-logo.svg"}
          width="126"
          height="22"
          alt="Zaane"
        />
      </Link>

      <BorderGlow
        className="nav-borderglow"
        borderRadius={999}
        backgroundColor="transparent"
        glowRadius={16}
        edgeSensitivity={25}
        glowColor="345 90 60"
        colors={["#f10c45", "#ff6b8a", "#ffffff"]}
        fillOpacity={0.35}
      >
        <div className="nav-tray">
          <PillLight />
          <nav className="nav-pill" aria-label="Main navigation">
            {links.map(([label, href]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </BorderGlow>

      <div className="header-cta3d">
        <Cta3DButton href="/services#inquiry" label="Start a project" />
      </div>

      <button
        type="button"
        className="site-menu"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="site-mobile"
        inert={open || undefined}
      >
        {open ? "Close −" : "Menu +"}
      </button>

      {open &&
        createPortal(
          <div id="site-mobile" className="mobile-overlay" role="dialog" aria-modal="true" aria-label="Mobile navigation">
            <button
              type="button"
              className="mobile-overlay-close"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={22} strokeWidth={1.75} />
            </button>

            <nav className="mobile-overlay-nav" aria-label="Primary">
              {[...links, ["Contact", "/contact"]].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={path === href ? "page" : undefined}
                >
                  <span className="mobile-overlay-plus">+</span>
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mobile-overlay-contact">
              <a href="mailto:hello@zaane.co">
                <span className="mobile-overlay-plus">+</span>
                hello@zaane.co
              </a>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
