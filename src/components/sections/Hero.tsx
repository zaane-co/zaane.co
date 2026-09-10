import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section id="top" className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start px-6 pb-24 pt-20 sm:pb-32 sm:pt-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs text-muted">
          Software · Apps · Business
        </div>

        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl sm:leading-tight">
          We build the software your business runs on.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Zaane is a software studio. We design and build custom software,
          mobile and web apps, and the business systems around them, from
          first sketch to a product your customers actually use.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <a
            href="#contact"
            className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Start a project
            <ArrowRight size={16} />
          </a>
          <a
            href="#services"
            className="flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            What we do
          </a>
        </div>
      </div>
    </section>
  );
}
