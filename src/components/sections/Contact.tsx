"use client";

import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";

const CONTACT_EMAIL = "hello@zaane.co";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`New project inquiry from ${name || "your site"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <section id="contact">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="p-10 sm:p-14">
              <h2 className="text-sm font-medium uppercase tracking-widest text-accent">
                Start a project
              </h2>
              <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Tell us what you&apos;re building.
              </p>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted">
                Share a few details and we&apos;ll get back to you within one
                business day. Prefer email? Reach us directly.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent"
              >
                <Mail size={16} />
                {CONTACT_EMAIL}
              </a>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 border-t border-border p-10 sm:p-14 lg:border-l lg:border-t-0"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-xs font-medium text-muted">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="Your name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-muted">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="you@company.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="message" className="text-xs font-medium text-muted">
                  Project details
                </label>
                <textarea
                  id="message"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="resize-none rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="What are you looking to build?"
                />
              </div>

              <button
                type="submit"
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Send message
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
