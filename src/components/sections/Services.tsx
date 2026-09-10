import { Code2, Smartphone, Briefcase } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Service = {
  icon: LucideIcon;
  title: string;
  description: string;
  items: string[];
};

const services: Service[] = [
  {
    icon: Code2,
    title: "Software",
    description:
      "Custom web platforms, internal tools, and integrations built for how your team actually works.",
    items: [
      "Web platforms & dashboards",
      "APIs & integrations",
      "Internal tools & automation",
    ],
  },
  {
    icon: Smartphone,
    title: "Apps",
    description:
      "Mobile and cross-platform apps designed and shipped from a blank screen to the app store.",
    items: [
      "iOS & Android apps",
      "Cross-platform builds",
      "Product design & UX",
    ],
  },
  {
    icon: Briefcase,
    title: "Business",
    description:
      "Technical strategy and the operating systems founders need to run a business, not just an app.",
    items: [
      "Product & technical strategy",
      "Process & operations systems",
      "Ongoing support & growth",
    ],
  },
];

export default function Services() {
  return (
    <section id="services" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-xl">
          <h2 className="text-sm font-medium uppercase tracking-widest text-accent">
            What we do
          </h2>
          <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Three disciplines. One team.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.title}
              className="flex flex-col rounded-2xl border border-border bg-surface p-8"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
                <service.icon size={20} className="text-accent-foreground" />
              </div>
              <h3 className="mt-6 text-xl font-semibold">{service.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {service.description}
              </p>
              <ul className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
                {service.items.map((item) => (
                  <li key={item} className="text-sm text-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
