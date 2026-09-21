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
import StepEntrance from "@/components/StepEntrance";
import PriceSlider from "@/components/PriceSlider";
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

        <StepEntrance className="benefits-cards">
          <div className="benefits-card">
            <span className="benefits-card-label">
              <Ticket size={16} strokeWidth={2} />
              Flexible pricing
            </span>
            <h3>Clear packages for different stages of growth.</h3>
            <PriceSlider />
          </div>

          <div className="benefits-card">
            <span className="benefits-card-label">
              <Laptop size={16} strokeWidth={2} />
              Priority support
            </span>
            <h3>Fast communication and quick turnaround on feedback.</h3>
            <div className="benefits-card-notif">
              <img
                src="/support3.png"
                alt=""
                className="benefits-card-support-img"
                loading="lazy"
              />
            </div>
          </div>

          <div className="benefits-card">
            <span className="benefits-card-label">
              <Zap size={16} strokeWidth={2} />
              Fast turnarounds
            </span>
            <h3>Clear timelines, every step of the way.</h3>
            <div className="benefits-card-time">
              <span className="benefits-card-time-label">
                Time to complete
              </span>
              <span className="benefits-card-time-value">14-21 days</span>
            </div>
            <div className="benefits-card-ruler" aria-hidden="true">
              <span className="benefits-card-ruler-accent" />
              <div className="benefits-card-ruler-track">
                {Array.from({ length: 2 }).map((_, dup) => (
                  <div className="benefits-card-ruler-set" key={dup}>
                    {Array.from({ length: 30 }).map((_, i) => {
                      const day = new Date();
                      day.setDate(day.getDate() + i - 15);
                      return (
                        <div className="benefits-card-ruler-tick" key={i}>
                          <span className="benefits-card-ruler-mark" />
                          {i % 4 === 0 && (
                            <span className="benefits-card-ruler-ticklabel">
                              {day.getDate()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </StepEntrance>
      </div>
    </section>
  );
}
