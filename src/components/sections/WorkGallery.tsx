import FlexCarousel from "@/components/FlexCarousel";

export default function WorkGallery() {
  return (
    <section id="our-work" className="wstack" aria-labelledby="wstack-title">
      <div className="wstack-intro">
        <h2 id="wstack-title">Our work</h2>
      </div>
      <div className="work-gallery-frame">
        <FlexCarousel
          preset="liquid"
          intro="rise"
          cardHeight={0.5}
          gap={12}
          squeeze={0.2}
          focusOnClick
          captions
          fit="natural"
          radius={0}
          lensWidth={0.74}
          lensHeight={1.18}
          tilt={62}
          roundness={1}
          bend={0.34}
          reach={0.38}
          curl="twist"
          dispersion={0.45}
          liquid={0}
          followCursor={false}
          autoplay={false}
          interval={4}
          captureWheel
        />
      </div>
    </section>
  );
}
