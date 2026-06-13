import { Hero } from "@/components/landing/hero";
import { Pillars } from "@/components/landing/pillars";

export const metadata = {
  title: "Andiamo — plan it, live it, adapt it",
  description:
    "An AI travel companion for the whole trip — not just the itinerary.",
};

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <Pillars />

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
