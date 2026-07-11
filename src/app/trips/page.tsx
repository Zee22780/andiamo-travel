import { PlacePhoto } from "@/components/place-photo";
import { loadTrips, TripCard, TripPhase } from "@/db/trips";

export const metadata = { title: "Your trips — Andiamo" };
export const dynamic = "force-dynamic";

// Per-phase styling for the card: a gradient placeholder header (no trip
// photos in the model) + a status pill that reads on top of it.
const PHASE: Record<
  TripPhase,
  { label: string; gradient: string; pillText: string }
> = {
  active: {
    label: "Active",
    gradient: "from-[#D96F32] to-[#b9551f]",
    pillText: "text-accent",
  },
  upcoming: {
    label: "Upcoming",
    gradient: "from-[#0E7C6B] to-[#0a4f44]",
    pillText: "text-primary",
  },
  planning: {
    label: "Planning",
    gradient: "from-[#13917d] to-[#0c6253]",
    pillText: "text-primary",
  },
  past: {
    label: "Past",
    gradient: "from-slate-400 to-slate-500",
    pillText: "text-on-surface-variant",
  },
};

function dateRange(start: string | null, end: string | null) {
  if (!start || !end) return "Dates TBD";
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} → ${fmt(end)}`;
}

// Dashboard sections, most-immediate first. loadTrips already sorts by recency
// within each phase; grouping keeps a Past trip from sitting between Upcoming
// ones. Sections with no trips are skipped.
const SECTIONS: { phase: TripPhase; heading: string }[] = [
  { phase: "active", heading: "Happening now" },
  { phase: "upcoming", heading: "Upcoming" },
  { phase: "planning", heading: "In planning" },
  { phase: "past", heading: "Past trips" },
];

function TripCardLink({ trip }: { trip: TripCard }) {
  const phase = PHASE[trip.phase];
  return (
    <a
      href={`/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-surface-variant/60 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <PlacePhoto
        query={trip.route[0] ?? undefined}
        width={600}
        gradient={`bg-gradient-to-br ${phase.gradient}`}
        className="h-28"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/15"
        />
        <span
          className={`absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold shadow-sm ${phase.pillText}`}
        >
          {phase.label}
        </span>
        {trip.route[0] && (
          <span className="absolute inset-x-4 bottom-3 truncate font-headline text-lg font-bold text-white drop-shadow">
            {trip.route[0]}
          </span>
        )}
      </PlacePhoto>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="font-headline text-lg font-bold leading-tight group-hover:text-primary">
          {trip.name}
        </h2>
        <p className="text-sm font-medium text-on-surface-variant">
          {dateRange(trip.startDate, trip.endDate)}
        </p>
        {trip.route.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant/80">
            {trip.route.map((city, i) => (
              <span key={`${city}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="text-surface-variant">→</span>}
                {city}
              </span>
            ))}
          </div>
        )}
        <p className="mt-auto pt-1 text-xs text-on-surface-variant/60">
          {trip.stopCount} stop{trip.stopCount === 1 ? "" : "s"} planned
        </p>
      </div>
    </a>
  );
}

export default async function TripsDashboard() {
  const trips = await loadTrips().catch(() => []);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-surface-variant bg-surface-warm px-6 py-4">
        <a href="/" className="font-headline text-2xl font-black text-primary">
          Andiamo
        </a>
        <a
          href="/trips/new"
          className="hidden rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-transform hover:opacity-90 active:scale-95 sm:inline-block"
        >
          Plan a new trip
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 sm:py-10">
        <h1 className="font-headline text-3xl font-black">Where to next?</h1>

        {/* Full-width primary CTA on mobile; desktop uses the header button. */}
        <a
          href="/trips/new"
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 sm:hidden"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>
          Plan a new trip
        </a>

        <div className="mt-6 sm:mt-8" />

        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-variant p-12 text-center">
            <p className="text-on-surface-variant">No trips yet.</p>
            <a
              href="/trips/new"
              className="mt-3 inline-block font-bold text-primary hover:underline"
            >
              Plan your first trip →
            </a>
          </div>
        ) : (
          <div className="space-y-10">
            {SECTIONS.map(({ phase, heading }) => {
              const group = trips.filter((t) => t.phase === phase);
              if (group.length === 0) return null;
              return (
                <section key={phase}>
                  <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant/70">
                    {heading}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.map((trip) => (
                      <TripCardLink key={trip.id} trip={trip} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
