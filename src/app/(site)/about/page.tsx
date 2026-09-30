import Link from "next/link";
import { Plus } from "lucide-react";
import { pageCopy, records, settings } from "@/lib/content";
import { safeUrl } from "@/lib/cms";

export const metadata = {
  title: "About | Zaane",
  description: "An independent studio bringing design, development and product thinking together.",
};

const fallbackImages = {
  hero: "https://images.unsplash.com/photo-1739056238917-d89cd05c48d5?w=2000&q=80&auto=format&fit=max",
  storyOne: "https://images.unsplash.com/photo-1747191092806-c7da11881986?w=1400&q=80&auto=format&fit=max",
  storyTwo: "https://images.unsplash.com/photo-1604854574958-59047362c165?w=1400&q=80&auto=format&fit=max",
};

const capabilities = [
  ["Design", "Brand & interface"],
  ["Development", "Web & mobile"],
  ["MVPs", "Idea to launch"],
  ["Strategy", "Scope & roadmap"],
  ["Support", "After launch"],
];

const clients = [
  ["Etivio", "Frame 99.svg"],
  ["FlatPurse Flow", "Frame 100.svg"],
  ["Runner", "Frame 101.svg"],
  ["Studio Mudiaga", "Frame 102.svg"],
  ["Hayyaa", "Frame 104.svg"],
  ["Emerging Leaders Africa", "Frame 110.svg"],
];

const services = [
  ["Graphics & Brand Design", "Identity & guidelines", "Design"],
  ["UI/UX Design", "Research & prototyping", "Design"],
  ["Web Development", "Responsive builds & CMS", "Development"],
  ["App Development", "iOS, Android & cross-platform", "Development"],
  ["MVP Development", "Scoping & launch", "Product"],
];

function Label({ name, index, dark }: { name: string; index: string; dark?: boolean }) {
  return (
    <div className={`ab-label${dark ? " is-dark" : ""}`}>
      <span>/ {name}</span>
      <span>({index})</span>
    </div>
  );
}

function Pill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="ab-pill">
      {children}
      <Plus size={15} strokeWidth={1.6} />
    </Link>
  );
}

export default async function Page() {
  const [team, config] = await Promise.all([records("team_members"), settings()]);
  const image = (key: string, fallback: string) => safeUrl(config[key]) || fallback;
  const [intro, approach, clientsIntro, teamIntro, story] = await Promise.all([
    pageCopy("about", "intro", "We're a design and development studio built on the belief that good ideas deserve a fair start."),
    pageCopy("about", "approach", "Every project begins with understanding. We take the time to listen, question, and uncover what truly matters. From there, we design and build with focus, removing anything that doesn't serve the goal."),
    pageCopy("about", "clients", "From early-stage founders to growing businesses, every relationship is built on trust, clear communication, and a shared goal."),
    pageCopy("about", "team", "Every project is shaped by close collaboration and a shared commitment to work that is useful and well made."),
    pageCopy("about", "story", "Too many good ideas stall between the pitch and the product. We set out to build something different, a studio that brings design, development and product thinking together so founders can move from idea to launch with confidence."),
  ]);
  const marquee = [...capabilities, ...capabilities];

  return (
    <main id="main" className="ab">
      <section className="ab-hero">
        <div className="ab-hero-top">
          <h1>About us.</h1>
          <p>{intro}</p>
        </div>
        <div className="ab-hero-meta">
          <div className="ab-marquee" aria-hidden="true">
            <div className="ab-marquee-track">
              {marquee.map(([strong, rest], i) => (
                <span key={i}>
                  <b>{strong}</b> {rest}
                  <i>/</i>
                </span>
              ))}
            </div>
          </div>
          <div className="ab-hero-sign">
            <span>Design. Development. MVPs.</span>
            <strong>© Zaane Studio</strong>
          </div>
        </div>
        <img className="ab-hero-image" src={image("about_hero_image", fallbackImages.hero)} alt="" />
      </section>

      <section className="ab-section">
        <Label name="Approach" index="01" />
        <h2 className="ab-title">
          Designed with clarity. <span>Built with purpose.</span>
        </h2>
        <div className="ab-row">
          <p className="ab-lead">{approach}</p>
          <Pill href="/projects">Our work</Pill>
        </div>
      </section>

      <section className="ab-section">
        <Label name="Our clients" index="02" />
        <div className="ab-clients">
          <div className="ab-clients-copy">
            <h3>We&rsquo;ve partnered with founders and brands to build work that is clear, useful, and built to last.</h3>
            <p>{clientsIntro}</p>
          </div>
          <div className="ab-logo-frame">
            {clients.map(([name, file]) => (
              <figure key={name} className="ab-logo-card">
                <figcaption>{name}</figcaption>
                <img src={`/client icons/${encodeURIComponent(file)}`} alt={name} loading="lazy" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="ab-section">
        <Label name="Capabilities" index="03" />
        <h2 className="ab-title">
          Services &amp; Disciplines <span>({services.length})</span>
        </h2>
        <div className="ab-table">
          {services.map(([title, focus, discipline], i) => (
            <div key={title} className="ab-table-row">
              <span>0{i + 1}</span>
              <strong>{title}</strong>
              <span>{focus}</span>
              <span>{discipline}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ab-team">
        <Label name="Our team" index="04" dark />
        <h2 className="ab-title">We&rsquo;re a group of designers, developers, and product thinkers.</h2>
        <div className="ab-row">
          <p className="ab-lead">{teamIntro}</p>
          <Pill href="/careers">Join us</Pill>
        </div>
        {team.length > 0 ? (
          <div className="ab-team-grid">
            {team.map((member) => (
              <figure key={member.id} className="ab-team-card">
                {safeUrl(member.photo_url) && <img src={safeUrl(member.photo_url)} alt={String(member.name)} loading="lazy" />}
                <figcaption>
                  <strong>{String(member.name)}</strong>
                  <span>{String(member.role)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="ab-team-empty">Team profiles are on the way. Talk to us to meet the people who will work on your project.</p>
        )}
      </section>

      <section className="ab-section">
        <Label name="Our story" index="05" />
        <h2 className="ab-title ab-title-stack">
          Zaane was born from a belief that
          <span>good ideas deserve a fair start.</span>
        </h2>
        <p className="ab-lead">{story}</p>
        <div className="ab-gallery">
          <figure>
            <figcaption>
              Idea <span>(01)</span>
            </figcaption>
            <img src={image("about_story_image_1", fallbackImages.storyOne)} alt="" loading="lazy" />
          </figure>
          <figure>
            <figcaption>
              Launch <span>(02)</span>
            </figcaption>
            <img src={image("about_story_image_2", fallbackImages.storyTwo)} alt="" loading="lazy" />
          </figure>
        </div>
      </section>
    </main>
  );
}
