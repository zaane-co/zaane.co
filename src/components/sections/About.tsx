import { ArrowUpRight, Asterisk } from "lucide-react";
export default function About() {
  return (
    <section
      id="about"
      className="studio-panel light-panel about-panel"
      data-reveal
    >
      <span className="eyebrow">About us</span>
      <div className="about-copy">
        <h2>
          We’re a software studio
          <br />
          turning bold ideas into
          <br />
          <span>everyday essentials.</span>
        </h2>
        <div className="about-detail">
          <p>
            Great software makes a difference you can feel. We bring product
            thinking, design, and engineering together to build apps and systems
            that move your business forward.
          </p>
          <p>
            From the first conversation to life after launch, you work directly
            with the people bringing your idea to life.
          </p>
        </div>
        <a className="studio-button black-button" href="#contact">
          Meet your next product team <ArrowUpRight size={19} />
        </a>
      </div>
      <div className="about-bottom">
        <Asterisk
          size={72}
          strokeWidth={1.1}
          className="slow-spin"
          aria-hidden="true"
        />
        <p>
          Good people.
          <br />
          Thoughtful products.
        </p>
        <span>
          Independent studio.
          <br />
          Built around your ambition.
        </span>
      </div>
    </section>
  );
}
