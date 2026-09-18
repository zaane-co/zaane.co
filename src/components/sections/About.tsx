import ScrollFillText from "@/components/ScrollFillText";
export default function About() {
  return (
    <section
      id="about"
      className="studio-panel light-panel about-panel"
    >
      <span className="eyebrow">About us</span>
      <div className="about-copy">
        <ScrollFillText
          className="about-heading"
          text="We help ambitious teams build brands, interfaces, websites, and apps with intention. From identity to launch, we bring together design, technology, and execution to turn ideas into working products."
        />
      </div>
    </section>
  );
}
