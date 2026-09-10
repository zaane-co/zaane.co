const steps = [
  {
    number: "01",
    title: "Discover",
    description:
      "We start with your business, not a feature list. What are you building, and why does it need to exist?",
  },
  {
    number: "02",
    title: "Design",
    description:
      "We map the product, the flows, and the architecture before a single line of code ships.",
  },
  {
    number: "03",
    title: "Build",
    description:
      "Short, visible cycles. You see working software every week, not a deck at the end of the month.",
  },
  {
    number: "04",
    title: "Launch & support",
    description:
      "We ship it, then stay close, fixing, improving, and building the next version with you.",
  },
];

export default function Process() {
  return (
    <section id="process" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-xl">
          <h2 className="text-sm font-medium uppercase tracking-widest text-accent">
            How we work
          </h2>
          <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            A straight line from idea to launch.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col bg-surface p-8">
              <span className="text-sm font-mono text-accent">{step.number}</span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
