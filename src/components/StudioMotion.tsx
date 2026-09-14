"use client";
import { useEffect } from "react";

export default function StudioMotion() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) {
            target.classList.remove("reveal-pending");
            observer.unobserve(target);
          }
        });
      },
      { threshold: 0.08 },
    );
    const showAll = () =>
      elements.forEach((el) => el.classList.remove("reveal-pending"));
    if (!media.matches)
      elements.forEach((el) => {
        if (el.getBoundingClientRect().top > window.innerHeight * 0.95)
          el.classList.add("reveal-pending");
        observer.observe(el);
      });
    media.addEventListener("change", showAll);
    return () => {
      observer.disconnect();
      showAll();
      media.removeEventListener("change", showAll);
    };
  }, []);
  return null;
}
