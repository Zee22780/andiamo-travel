"use client";

import { Badge } from "@/components/ui/badge";

// Mirrors the Itinerary zod type; duplicated here to keep this component
// client-safe without importing server-side schema modules.
export type PreviewItinerary = {
  tripName: string;
  legs: {
    destination: string;
    startDate: string;
    endDate: string;
    lodging: string | null;
    days: {
      date: string;
      notes: string | null;
      stops: {
        type: "activity" | "meal" | "lodging" | "transit";
        title: string;
        description: string | null;
        startTime: string;
        durationMin: number;
        costEstimate: number | null;
        mustDo: boolean;
        // Library-referenced stops stream in already verified.
        verification?: string;
      }[];
    }[];
  }[];
};

const TYPE_ICONS: Record<string, string> = {
  activity: "🏛️",
  meal: "🍽️",
  lodging: "🛏️",
  transit: "🚆",
};

export function ItineraryPreview({
  itinerary,
  inProgress = false,
}: {
  itinerary: PreviewItinerary;
  inProgress?: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="font-headline text-3xl font-black">
            {itinerary.tripName}
          </h1>
          <div className="flex flex-wrap items-center gap-1 text-sm text-on-surface-variant">
            {itinerary.legs.map((leg, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-surface-variant">→</span>}
                <span className="font-semibold">{leg.destination}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-on-surface-variant/60">
            Known places arrive already verified — the rest get checked by the
            trust layer.
          </p>
        </header>

        {itinerary.legs.map((leg, li) => (
          <section key={li} className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-surface-variant pb-2">
              <h2 className="font-headline text-xl font-bold text-primary">
                {leg.destination}
              </h2>
              <span className="text-xs font-medium text-on-surface-variant">
                {leg.startDate} → {leg.endDate}
                {leg.lodging ? ` · stay near ${leg.lodging}` : ""}
              </span>
            </div>

            {leg.days.map((day, di) => (
              <div
                key={di}
                className="rounded-xl border border-surface-variant/50 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-sm font-bold">{day.date}</span>
                  {day.notes && (
                    <span className="text-xs italic text-on-surface-variant">
                      {day.notes}
                    </span>
                  )}
                </div>
                <ol className="space-y-2">
                  {day.stops.map((stop, si) => (
                    <li key={si} className="flex items-start gap-3 text-sm">
                      <span className="w-12 shrink-0 font-mono text-xs text-on-surface-variant">
                        {stop.startTime}
                      </span>
                      <span aria-hidden>{TYPE_ICONS[stop.type] ?? "📍"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{stop.title}</span>
                          {stop.mustDo && (
                            <Badge className="rounded-full bg-accent/10 text-accent">
                              must-do
                            </Badge>
                          )}
                          {/* Stops without the badge aren't unchecked — the
                              canvas auto-verifies them the moment it opens. */}
                          {stop.verification === "verified" && (
                            <Badge
                              variant="secondary"
                              className="rounded-full bg-primary/10 text-primary"
                            >
                              ✓ Verified
                            </Badge>
                          )}
                        </div>
                        {stop.description && (
                          <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">
                            {stop.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-on-surface-variant/60">
                          {Math.round(stop.durationMin / 6) / 10}h
                          {stop.costEstimate != null
                            ? ` · ~$${stop.costEstimate}/person`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        ))}

        {inProgress && (
          <div className="animate-pulse rounded-xl border border-dashed border-surface-variant bg-white/60 p-4 text-sm text-on-surface-variant">
            Planning the next stops…
          </div>
        )}
      </div>
    </div>
  );
}
