"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const PILLARS = [
  {
    icon: "🗺️",
    tint: "bg-primary/10 text-primary",
    title: "Plans with you",
    body: "A conversation builds a real day-by-day itinerary you can actually edit — not one you have to regenerate from scratch.",
  },
  {
    icon: "✓",
    tint: "bg-primary/10 text-primary",
    title: "Never makes things up",
    body: "Every place is checked against live data, or clearly marked as an AI guess. Travel times are real, so your days are physically possible.",
  },
  {
    icon: "🧭",
    tint: "bg-accent/15 text-accent",
    title: "Travels with you",
    body: "Once you land, it flips to Today: what's next, the weather, and one-tap replanning when reality intervenes.",
  },
];

export function Pillars() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from("[data-pillar]", {
        scrollTrigger: { trigger: root.current, start: "top 80%" },
        y: 40,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: "power3.out",
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="how"
      className="bg-surface-warm px-6 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="max-w-xl font-headline text-3xl font-black sm:text-4xl">
          The AI travel app that stays useful after you board the plane.
        </h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              data-pillar
              className="flex flex-col gap-3 rounded-xl border border-surface-variant/60 bg-white p-6 shadow-sm"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold ${p.tint}`}
                aria-hidden
              >
                {p.icon}
              </span>
              <h3 className="font-headline text-lg font-bold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
