import Link from "next/link";
import { Fraunces } from "next/font/google";
import { records } from "@/lib/content";
import { safeUrl } from "@/lib/cms";

export const metadata = {
  title: "Projects | Zaane",
  description: "Explore Zaane’s design and development work, from brands to digital products.",
};

const display = Fraunces({ subsets: ["latin"], weight: ["700"], display: "swap" });

const tabs: [string, string][] = [
  ["All", ""],
  ["Brand design", "Graphics & Brand Design"],
  ["UI/UX design", "UI/UX Design"],
  ["Web design", "Web Design"],
  ["App design", "App Design"],
];

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const all = await records("projects");
  const { type = "" } = await searchParams;
  const rows = all.filter((r) => !type || r.sub_category === type);

  return (
    <main id="main" className="wk">
      <section className="wk-hero">
        <h1 className={display.className}>Selected Work</h1>
        <div className="wk-hero-foot">
          <p>
            A collection of selected projects, built to solve real problems and create experiences people
            genuinely enjoy using.
          </p>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </section>

      <nav className="wk-tabs" aria-label="Filter projects">
        {tabs.map(([label, value]) => (
          <Link
            key={label}
            href={value ? `/projects?type=${encodeURIComponent(value)}` : "/projects"}
            aria-current={type === value ? "page" : undefined}
            scroll={false}
          >
            {label}
          </Link>
        ))}
      </nav>

      {rows.length > 0 ? (
        <div className="wk-grid">
          {rows.map((r) => {
            const cover = safeUrl(r.cover_image);
            return (
              <Link key={r.id} href={`/projects/${r.slug}`} className="wk-tile">
                {cover ? <img src={cover} alt={String(r.title)} loading="lazy" /> : <span className="wk-tile-blank" />}
                <span className="wk-tile-label">
                  <strong>{String(r.title)}</strong>
                  <span>{String(r.sub_category || r.category)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="wk-empty">
          <p>No projects in this category yet.</p>
          <Link href="/projects">See all work</Link>
        </div>
      )}
    </main>
  );
}
