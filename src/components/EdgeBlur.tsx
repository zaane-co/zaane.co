import styles from "./EdgeBlur.module.css";

// A fixed, viewport-pinned blur strip at the bottom of the screen. Content
// scrolling underneath it goes progressively softer the closer it gets to
// the edge, fully sharp above it. Pure CSS, no scroll listeners needed.
// Stacks several backdrop-filter layers, each blurred a different amount
// and masked to a different band, so the blur itself reads as a smooth
// gradient rather than a single hard-edged blurred block.
export default function EdgeBlur() {
  return (
    <div className={styles.edgeBlur} aria-hidden="true">
      <div className={styles.l1} />
      <div className={styles.l2} />
      <div className={styles.l3} />
      <div className={styles.l4} />
      <div className={styles.l5} />
    </div>
  );
}
