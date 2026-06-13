import { PlacePhoto } from "@/components/place-photo";

export const metadata = {
  title: "Andiamo — plan it, live it, adapt it",
  description:
    "An AI travel companion for the whole trip — not just the itinerary.",
};

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

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0E7C6B] via-[#0c6a5b] to-[#0a4f44] text-white">
        {/* travel photo behind a teal scrim for contrast (gradient fallback) */}
        <PlacePhoto
          query="Amalfi Coast Italy"
          width={1280}
          gradient=""
          className="absolute inset-0"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-[#0E7C6B]/70 via-[#0c6a5b]/45 to-[#0a4f44]/80"
          />
        </PlacePhoto>
        {/* warm accent glow */}
        <div
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
          <p className="mb-4 text-sm font-bold uppercase tracking-widest text-white drop-shadow-sm">
            Your AI travel companion
          </p>
          <h1 className="max-w-2xl font-headline text-5xl font-black leading-[1.05] sm:text-6xl lg:text-7xl">
            Plan it. Live it. Adapt it.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white drop-shadow-sm">
            Andiamo plans a real multi-week trip with you, verifies every place,
            and stays useful after you board the plane.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="/trips/new"
              className="rounded-full bg-white px-7 py-3.5 text-center text-base font-bold text-primary shadow-lg transition-transform hover:opacity-95 active:scale-95"
            >
              Plan a trip
            </a>
            <a
              href="#how"
              className="rounded-full bg-accent px-7 py-3.5 text-center text-base font-bold text-white shadow-lg transition-transform hover:opacity-95 active:scale-95"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* Feature pillars */}
      <section
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

      {/* Closing CTA */}
      <section className="bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 rounded-2xl bg-gradient-to-br from-[#0E7C6B] to-[#0a4f44] px-8 py-12 text-center text-white shadow-lg">
          <h2 className="font-headline text-3xl font-black sm:text-4xl">
            Where to next?
          </h2>
          <p className="max-w-md text-white/95">
            Tell Andiamo where you're dreaming of, and watch a real plan take
            shape.
          </p>
          <a
            href="/trips/new"
            className="rounded-full bg-white px-7 py-3.5 text-base font-bold text-primary shadow-lg transition-transform hover:opacity-95 active:scale-95"
          >
            Start planning
          </a>
        </div>
      </section>
    </main>
  );
}
