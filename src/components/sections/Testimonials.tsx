"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";
import { safeUrl } from "@/lib/cms";
import type { ContentRow } from "@/lib/content";

const PAGE_SIZE = 5;

// The entrance animation's fill-mode keeps pinning `transform` after it
// finishes, which outranks a plain `:hover` rule in the cascade and would
// silently block the hover-lift. Clearing the animation once it ends frees
// `transform` back up for hover/transition to control.
function clearFinishedAnimation(e: React.AnimationEvent<HTMLDivElement>) {
  if (e.animationName === "showcase-item-in") {
    (e.target as HTMLElement).style.animation = "none";
  }
}

function QuoteCard({ row, accent }: { row: ContentRow; accent?: boolean }) {
  const photo = safeUrl(row.photo_url);
  return (
    <figure className={`showcase-card${accent ? " showcase-card-accent" : ""}`}>
      <span className="showcase-quote-mark" aria-hidden="true">
        ”
      </span>
      <blockquote>“{String(row.quote)}”</blockquote>
      <figcaption>
        <div className="showcase-person">
          {photo && <img src={photo} alt="" loading="lazy" />}
          <div>
            <strong>{String(row.client_name)}</strong>
            <p>{String(row.client_role)}</p>
          </div>
        </div>
        <span className="showcase-badge" aria-hidden="true">
          <Quote size={12} strokeWidth={2.4} />
        </span>
      </figcaption>
    </figure>
  );
}

export default function Testimonials({ rows }: { rows: ContentRow[] }) {
  const [page, setPage] = useState(0);
  const count = rows.length;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const slice = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const [featured, ...rest] = slice;
  const left = rest.slice(0, 2);
  const right = rest.slice(2, 4);
  const featuredPhoto = featured ? safeUrl(featured.photo_url) : "";

  return (
    <section id="testimonials" className="studio-panel light-panel testimonial-showcase" data-reveal>
      <div className="showcase-panel">
        <div className="showcase-top">
          <div>
            <span className="showcase-eyebrow">Client stories</span>
            <h2 className="showcase-heading-title">
              Trusted by teams
              <br />
              building what&rsquo;s next.
            </h2>
          </div>
          <p className="showcase-heading-note">
            See how founders and product teams work with Zaane to design, build and ship with
            confidence.
          </p>
        </div>

        {count === 0 && (
          <div className="empty-state">
            <span className="empty-mark">”</span>
            <h3>The work comes first.</h3>
            <p>Client stories will be shared here as they&rsquo;re approved for publication.</p>
          </div>
        )}

        {count > 0 && featured && (
          <div className="showcase-page" key={page}>
            <div className="showcase-grid" onAnimationEnd={clearFinishedAnimation}>
              <div className="showcase-column">
                {left.map((row) => (
                  <QuoteCard key={row.id} row={row} />
                ))}
              </div>
              <div className="showcase-feature">
                {featuredPhoto && (
                  <div className="showcase-photo">
                    <img src={featuredPhoto} alt="" loading="lazy" />
                  </div>
                )}
                <QuoteCard row={featured} accent />
              </div>
              <div className="showcase-column">
                {right.map((row) => (
                  <QuoteCard key={row.id} row={row} />
                ))}
              </div>
            </div>

            {pageCount > 1 && (
              <div className="showcase-footer">
                <div className="showcase-dots">
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={i === page ? "is-active" : ""}
                      aria-label={`Show testimonials page ${i + 1}`}
                      aria-current={i === page}
                      onClick={() => setPage(i)}
                    />
                  ))}
                </div>
                <div className="showcase-arrows">
                  <button
                    type="button"
                    aria-label="Previous testimonials"
                    onClick={() => setPage((page - 1 + pageCount) % pageCount)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="is-primary"
                    aria-label="Next testimonials"
                    onClick={() => setPage((page + 1) % pageCount)}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
