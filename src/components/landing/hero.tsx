"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { PlacePhoto } from "@/components/place-photo";

gsap.registerPlugin(ScrollTrigger);

const HEADLINE = ["Plan it.", "Live it.", "Adapt it."];

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Respect users who prefer reduced motion — leave everything in its
      // final, fully-visible state (gsap.from would otherwise hide-then-reveal).
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-hero='eyebrow']", { y: 16, opacity: 0, duration: 0.5 })
        .from(
          "[data-hero='line']",
          { yPercent: 120, duration: 0.7, stagger: 0.12 },
          "-=0.15",
        )
        .from(
          "[data-hero='subtitle']",
          { y: 16, opacity: 0, duration: 0.6 },
          "-=0.35",
        )
        .from(
          "[data-hero='cta']",
          { y: 16, opacity: 0, duration: 0.5, stagger: 0.1 },
          "-=0.3",
        );

      // Ambient drift on the warm accent glow — a slow, looping float so the
      // hero feels alive even when idle. sine ease + yoyo keeps it organic.
      gsap.to("[data-hero='glow']", {
        xPercent: -10,
        yPercent: 12,
        scale: 1.12,
        duration: 7,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      // Parallax: drift the hero photo slower than the page on scroll so it
      // reads as a recessed layer. Desktop only — the effect is weak on short
      // viewports and scroll-linked motion can stutter on mobile browsers. The
      // photo lives in a scale-110 frame, so ±5% of drift never reveals a gap.
      if (window.matchMedia("(min-width: 768px)").matches) {
        gsap.fromTo(
          "[data-hero='photo']",
          { yPercent: -5 },
          {
            yPercent: 5,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          },
        );
      }
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative overflow-hidden bg-gradient-to-br from-[#0E7C6B] via-[#0c6a5b] to-[#0a4f44] text-white"
    >
      {/* travel photo behind a teal scrim for contrast (gradient fallback);
          the scale-110 wrapper is the parallax layer (see useGSAP above) */}
      <div data-hero="photo" aria-hidden className="absolute inset-0 scale-110">
        <PlacePhoto
          query="Amalfi Coast Italy"
          width={1280}
          gradient=""
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0E7C6B]/70 via-[#0c6a5b]/45 to-[#0a4f44]/80" />
        </PlacePhoto>
      </div>
      {/* warm accent glow */}
      <div
        data-hero="glow"
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl"
      />
      <div className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="font-headline text-2xl font-black tracking-tight">
          Andiamo
        </span>
        <a
          href="/trips"
          className="text-sm font-bold text-white drop-shadow-sm transition-opacity hover:opacity-80"
        >
          Your trips
        </a>
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-6 pb-16 pt-10 sm:pb-24 sm:pt-16 lg:pt-24">
        <p
          data-hero="eyebrow"
          className="mb-4 text-sm font-bold uppercase tracking-widest text-white drop-shadow-sm"
        >
          Your AI travel companion
        </p>
        <h1 className="max-w-2xl font-headline text-5xl font-black leading-[1.05] sm:text-6xl lg:text-7xl">
          {HEADLINE.map((line, i) => (
            <span
              key={line}
              // overflow-hidden masks the slide-up reveal of each phrase;
              // mr supplies the inter-phrase space an inline-block would drop
              className={`inline-block overflow-hidden pb-[0.12em] align-bottom${
                i < HEADLINE.length - 1 ? " mr-[0.28em]" : ""
              }`}
            >
              <span data-hero="line" className="inline-block">
                {line}
              </span>
            </span>
          ))}
        </h1>
        <p
          data-hero="subtitle"
          className="mt-5 max-w-xl text-lg leading-relaxed text-white drop-shadow-sm"
        >
          Andiamo plans a real multi-week trip with you, verifies every place,
          and stays useful after you board the plane.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            data-hero="cta"
            href="/trips/new"
            className="rounded-full bg-white px-7 py-3.5 text-center text-base font-bold text-primary shadow-lg transition-transform hover:opacity-95 active:scale-95"
          >
            Plan a trip
          </a>
          <a
            data-hero="cta"
            href="#how"
            className="rounded-full bg-electric px-7 py-3.5 text-center text-base font-bold text-white shadow-lg transition-transform hover:opacity-95 active:scale-95"
          >
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
