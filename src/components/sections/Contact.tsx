"use client";
import { useState } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
export default function Contact() {
  const [prepared, setPrepared] = useState(false);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = encodeURIComponent(
      `Project inquiry: ${data.get("service")}`,
    );
    const body = encodeURIComponent(
      `Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`,
    );
    window.location.href = `mailto:hello@zaane.co?subject=${subject}&body=${body}`;
    setPrepared(true);
  }
  return (
    <section id="contact" className="studio-panel contact-panel" data-reveal>
      <div className="contact-copy">
        <span className="eyebrow">Let’s make it happen</span>
        <h2>
          Got an idea?
          <br />
          Let’s build
          <br />
          <span>something great.</span>
        </h2>
        <a href="mailto:hello@zaane.co" className="contact-email">
          hello@zaane.co
          <ArrowUpRight />
        </a>
        <p>
          Tell us where you want to go.
          <br />
          We’ll figure out how to get there, together.
        </p>
      </div>
      <form onSubmit={submit} className="contact-form">
        <label>
          Your name
          <input
            name="name"
            autoComplete="name"
            placeholder="Alex Taylor"
            required
          />
        </label>
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="alex@company.com"
            required
          />
        </label>
        <label>
          What are you looking to build?
          <select name="service" defaultValue="" required>
            <option value="" disabled>
              Select a service
            </option>
            <option>Custom software</option>
            <option>Mobile & web apps</option>
            <option>Product design</option>
            <option>Business systems</option>
            <option>Ongoing partnership</option>
          </select>
        </label>
        <label>
          A little about your project
          <textarea
            name="message"
            rows={3}
            placeholder="The idea, the challenge, the ambition…"
            required
          />
        </label>
        <button className="studio-button black-button" type="submit">
          Let’s talk
          <ArrowRight size={19} />
        </button>
        <p className="form-note" role="status">
          {prepared
            ? "Your email draft is ready in your mail app. Send it there to complete your inquiry."
            : "Opens your email app with your project details."}
        </p>
      </form>
    </section>
  );
}
