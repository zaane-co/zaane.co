import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import ScrollFillText from "@/components/ScrollFillText";
import StepCards from "@/components/StepCards";
import { safeUrl } from "@/lib/cms";
import type { ContentRow } from "@/lib/content";

type Props = {
  testimonial?: ContentRow;
  project?: ContentRow;
};

// Shown only until a real testimonial/project exists in Supabase. Swap
// these out (or just publish real rows) whenever that content is ready.
const PLACEHOLDER_TESTIMONIAL = {
  rating: 5,
  quote:
    "The team felt like an extension of ours. Thoughtful, fast, and easy to work with from day one.",
  photo_url: "/ff1.jpeg",
  client_name: "Anne",
  client_role: "CEO, Finance with Anne",
};
const PLACEHOLDER_PROJECT = {
  title: "Studio Mudiaga",
  short_description: "A brand built to grow",
  cover_image: "/animated img/midiagadp1.png",
  slug: "",
};

export default function About({ testimonial, project }: Props) {
  const quote = testimonial ?? PLACEHOLDER_TESTIMONIAL;
  // Only swap the placeholder out for a project tied to a real client;
  // concept/visual-only entries (blank client_name) shouldn't bump it.
  const hasRealClient = !!project && !!String(project.client_name ?? "").trim();
  const work = hasRealClient ? project! : PLACEHOLDER_PROJECT;
  const isPlaceholderProject = !hasRealClient;

  return (
    <section id="about" className="studio-panel light-panel about-panel">
      <span className="eyebrow no-dot">Who we are</span>
      <div className="about-copy">
        <ScrollFillText
          className="about-heading"
          text="We help ambitious teams build brands, interfaces, websites, and apps with intention. From identity to launch, we bring together design, technology, and execution to turn ideas into working products."
        />

        <div className="about-highlights">
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
    </section>
  );
}
