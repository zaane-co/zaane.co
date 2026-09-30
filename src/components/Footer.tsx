import Link from "next/link";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { settings } from "@/lib/content";
import { safeUrl } from "@/lib/cms";

const columns: [string, [string, string][]][] = [
  ["Explore", [["Work", "/projects"], ["Services", "/services"], ["About", "/about"], ["Pricing", "/pricing"]]],
  ["Company", [["Journal", "/blog"], ["Client stories", "/testimonials"], ["Partnerships", "/brand-partnerships"], ["Careers", "/careers"], ["Resources", "/resources"]]],
  ["Support", [["Contact", "/contact"], ["FAQ", "/faq"], ["Privacy policy", "/privacy-policy"], ["Terms of service", "/terms-of-service"]]],
];

const icon = (children: ReactNode, filled = false) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const socials: [string, string, ReactNode][] = [
  ["facebook_url", "Facebook", icon(<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />)],
  ["instagram_url", "Instagram", icon(<><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" /></>)],
  ["x_url", "X", icon(<path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h6.9l4.8 6.3L18.9 2Zm-1.2 18h1.9L6.2 4H4.2l13.5 16Z" />, true)],
  ["linkedin_url", "LinkedIn", icon(<><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></>)],
];

export default async function Footer() {
  const config = await settings().catch(() => ({}) as Record<string, string>);
  const links = socials.filter(([key]) => safeUrl(config[key]));

  return (
    <footer className="zfoot">
      <div className="zfoot-grid">
        <div className="zfoot-brand">
          <Link href="/" aria-label="Zaane home">
            <img src="/zaane-logo-light.svg" alt="Zaane" width={210} height={36} />
          </Link>
          <div className="zfoot-touch">
            <span>Stay in touch!</span>
            <div className="zfoot-social">
              {links.map(([key, label, svg]) => (
                <a key={key} href={safeUrl(config[key])} target="_blank" rel="noreferrer" aria-label={label}>
                  {svg}
                </a>
              ))}
              <a href="mailto:hello@zaane.co" aria-label="Email Zaane">
                <Mail size={18} />
              </a>
            </div>
          </div>
        </div>
        <div className="zfoot-main">
          <span className="zfoot-mark" aria-hidden="true" />
          <nav className="zfoot-cols" aria-label="Footer navigation">
            {columns.map(([title, items]) => (
              <div key={title}>
                <h3>{title}</h3>
                <ul>
                  {items.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href}>{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="zfoot-bottom">
            <span>
              © {new Date().getFullYear()} <strong>Zaane</strong>. All rights reserved.
            </span>
            <span>Design. Development. MVPs.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
