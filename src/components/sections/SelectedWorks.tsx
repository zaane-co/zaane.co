"use client";
import { useState } from "react";
import { ProjectCard, Empty } from "@/components/PageParts";
import type { ContentRow } from "@/lib/content";

const TABS = [
  "Website",
  "Graphic Design",
  "Branding",
  "Logo",
  "Social Media",
  "App",
  "Ecommerce",
  "UI/UX",
];

export default function SelectedWorks({ projects }: { projects: ContentRow[] }) {
  const [active, setActive] = useState(TABS[0]);
  const filtered = projects.filter((row) => String(row.work_category) === active);

  return (
    <section
      id="selected-works"
      className="studio-panel light-panel"
      data-reveal
    >
      <div className="section-heading">
        <h2>Selected works.</h2>
        <span className="eyebrow">By discipline</span>
      </div>
      <div
        className="filter-bar"
        role="tablist"
        aria-label="Filter selected work by discipline"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => setActive(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="work-grid">
          {filtered.map((row) => (
            <ProjectCard row={row} key={row.id} />
          ))}
        </div>
      ) : (
        <Empty
          title={`No ${active.toLowerCase()} work published yet.`}
          body="Real case studies land here as they're ready to share. Ask us about relevant work in the meantime."
        />
      )}
    </section>
  );
}
