import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Handshake,
  Laptop,
  Plus,
  Ticket,
  Zap,
} from "lucide-react";
import ScrollFillText from "@/components/ScrollFillText";
import StepCards from "@/components/StepCards";
import { safeUrl } from "@/lib/cms";
import type { ContentRow } from "@/lib/content";

type Props = {
  testimonial?: ContentRow;
  project?: ContentRow;
};

// Shown only until a real testimonial/project exists in Supabase — swap
// these out (or just publish real rows) whenever that content is ready.
const PLACEHOLDER_TESTIMONIAL = {
  rating: 5,
  quote:
    "The team felt like an extension of ours — thoughtful, fast, and easy to work with from day one.",
  photo_url: "/animated img/Ellipse 11.png",
  client_name: "Sarah Chen",
  client_role: "Founder, Loop Studio",
};
const PLACEHOLDER_PROJECT = {
  title: "Studio Mudiaga",
  short_description: "A brand built to grow",
  cover_image: "/animated img/midiagadp1.png",
  slug: "",
};

export default function About({ testimonial, project }: Props) {
  const quote = testimonial ?? PLACEHOLDER_TESTIMONIAL;
  const work = project ?? PLACEHOLDER_PROJECT;
  const isPlaceholderProject = !project;

  return (
    <section id="about" className="studio-panel light-panel about-panel">
      <span className="eyebrow no-dot">Who we are</span>
      <div className="about-copy">
        <ScrollFillText
          className="about-heading"
          text="We help ambitious teams build brands, interfaces, websites, and apps with intention. From identity to launch, we bring together design, technology, and execution to turn ideas into working products."
        />

        <div className="about-highlights">
          <Link href="/about" className="about-highlights-link">
            More about us
            <ArrowRight size={16} strokeWidth={2} />
          </Link>
          <StepCards className="about-highlights-grid">
            <figure className="about-quote-card">
              {Number(quote.rating) > 0 && (
                <span
                  className="about-quote-stars"
                  aria-label={`${quote.rating} out of 5 stars`}
                >
                  {"★".repeat(Number(quote.rating))}
                </span>
              )}
              <blockquote>“{String(quote.quote)}”</blockquote>
              <figcaption>
                {safeUrl(quote.photo_url) && (
                  <img src={safeUrl(quote.photo_url)} alt="" loading="lazy" />
                )}
                <div>
                  <strong>{String(quote.client_name)}</strong>
                  <span>{String(quote.client_role)}</span>
                </div>
              </figcaption>
            </figure>
            <Link
              href={isPlaceholderProject ? "/projects" : `/projects/${work.slug}`}
              className="about-project-card"
            >
              <span className="about-project-plus" aria-hidden="true">
                <Plus size={18} />
              </span>
              <div className="about-project-image">
                {safeUrl(work.cover_image) && (
                  <img src={safeUrl(work.cover_image)} alt="" loading="lazy" />
                )}
              </div>
              <div className="about-project-caption">
                <div className="about-project-info">
                  <span className="about-project-mark">
                    <img src="/animated img/mudiaga-one.png" alt="" loading="lazy" />
                  </span>
                  <div>
                    <h3>{String(work.title)}</h3>
                    <p>{String(work.short_description)}</p>
                  </div>
                </div>
                <ArrowUpRight size={18} />
              </div>
            </Link>
          </StepCards>
        </div>
      </div>

      <div className="benefits-row">
        <span className="eyebrow icon-eyebrow">
          <Handshake size={16} strokeWidth={2} />
          Benefits
        </span>
        <div className="benefits-copy">
          <ScrollFillText
            className="about-heading"
            text="We focus on making your business stand out with work that's useful, flexible, and built for the long term."
          />
          <p className="benefits-text">
            Our clients come to us because they want more than good-looking
            visuals. They want design that solves problems, branding that
            resonates, and websites that actually perform.
          </p>
        </div>

        <div className="benefits-cards">
          <div className="benefits-card">
            <span className="benefits-card-label">
              <Ticket size={16} strokeWidth={2} />
              Flexible pricing
            </span>
            <h3>Clear packages for different stages of growth.</h3>
            <div className="benefits-card-price">
              <span className="benefits-card-price-label">Starting from</span>
              <span className="benefits-card-price-value">$2,500</span>
              <div className="benefits-card-slider">
                <span style={{ width: "70%" }} />
              </div>
              <div className="benefits-card-slider-labels">
                <span>Start simple</span>
                <span>Expand as you go</span>
              </div>
            </div>
          </div>

          <div className="benefits-card">
            <span className="benefits-card-label">
              <Laptop size={16} strokeWidth={2} />
              Priority support
            </span>
            <h3>Fast communication and quick turnaround on feedback.</h3>
            <div className="benefits-card-notif">
              <div className="benefits-card-phone">
                <span className="benefits-card-notif-time">27/7</span>
                <strong>Support</strong>
                <span className="benefits-card-phone-notch" />
              </div>
              <div className="benefits-card-toast">
                <span className="benefits-card-toast-dot" />
                <div>
                  <div className="benefits-card-toast-top">
                    <span>TRELLO</span>
                    <em>1m ago</em>
                  </div>
                  <p>[...] Requested design change</p>
                </div>
              </div>
            </div>
          </div>

          <div className="benefits-card">
            <span className="benefits-card-label">
              <Zap size={16} strokeWidth={2} />
              Fast turnarounds
            </span>
            <h3>Days, not weeks. We keep projects moving.</h3>
            <div className="benefits-card-time">
              <span className="benefits-card-time-label">
                Time to complete
              </span>
              <span className="benefits-card-time-value">24-36h</span>
              <svg
                className="benefits-card-clock"
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="#d8d8d8"
                  strokeWidth="2"
                />
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="26"
                  stroke="#c8c8c8"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line
                  x1="50"
                  y1="50"
                  x2="68"
                  y2="62"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="50" cy="50" r="3.5" fill="var(--accent)" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
