import { Check } from "lucide-react";

const points = [
  "One team across product, engineering, and design",
  "Direct access to the people building your product",
  "Built to run in production, not just in a demo",
  "We stay on after launch, not just through it",
];

export default function About() {
  return (
    <section id="about" className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-widest text-accent">
            About Zaane
          </h2>
          <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            A studio built for founders who need to ship.
          </p>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted">
            Zaane exists because most businesses do not need a bigger team,
            they need the right software built the right way. We work like a
            product team inside your company: close, fast, and honest about
            what it takes to get from an idea to something real.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-4">
          {points.map((point) => (
            <div key={point} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent">
                <Check size={14} className="text-accent-foreground" />
              </div>
              <span className="text-sm leading-relaxed text-foreground">
                {point}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
