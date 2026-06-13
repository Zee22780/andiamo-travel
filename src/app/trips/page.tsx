import { loadTrips, TripPhase } from "@/db/trips";

export const metadata = { title: "Your trips — Andiamo" };
export const dynamic = "force-dynamic";

const PHASE_PILL: Record<TripPhase, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-accent/15 text-accent" },
  upcoming: { label: "Upcoming", className: "bg-primary/10 text-primary" },
  planning: {
    label: "Planning",
    className: "bg-amber-50 text-amber-700",
  },
  past: { label: "Past", className: "bg-surface-variant text-on-surface-variant" },
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
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-transform hover:opacity-90 active:scale-95"
        >
          Plan a new trip
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 font-headline text-3xl font-black">Your trips</h1>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => {
              const pill = PHASE_PILL[trip.phase];
              return (
                <a
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="group flex flex-col gap-3 rounded-xl border border-surface-variant/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-headline text-lg font-bold leading-tight group-hover:text-primary">
                      {trip.name}
                    </h2>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-on-surface-variant">
                    {dateRange(trip.startDate, trip.endDate)}
                  </p>
                  {trip.route.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant/80">
                      {trip.route.map((city, i) => (
                        <span key={`${city}-${i}`} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-surface-variant">→</span>
                          )}
                          {city}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-auto text-xs text-on-surface-variant/60">
                    {trip.stopCount} stop{trip.stopCount === 1 ? "" : "s"} planned
                  </p>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
