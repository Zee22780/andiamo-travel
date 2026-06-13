"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { StopCard } from "./stop-card";
import { CanvasTrip } from "./types";

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TripCanvas({ trip }: { trip: CanvasTrip }) {
  const [activeLegId, setActiveLegId] = useState<string | null>(null);

  const allDays = useMemo(
    () =>
      trip.legs.flatMap((leg, li) =>
        leg.days.map((day, di) => ({
          leg,
          day,
          dayNumber:
            trip.legs.slice(0, li).reduce((n, l) => n + l.days.length, 0) +
            di +
            1,
        })),
      ),
    [trip],
  );

  const visibleDays = activeLegId
    ? allDays.filter(({ leg }) => leg.id === activeLegId)
    : allDays;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Leg bar */}
      <div className="flex items-center gap-2 border-b border-surface-variant bg-white px-6 py-3">
        <span className="mr-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant/50">
          Route
        </span>
        <button
          onClick={() => setActiveLegId(null)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            activeLegId === null
              ? "bg-primary/10 font-bold text-primary"
              : "text-on-surface-variant hover:bg-surface-warm",
          )}
        >
          All
        </button>
        {trip.legs.map((leg, i) => (
          <span key={leg.id} className="flex items-center gap-2">
            {i >= 0 && (
              <span className="text-sm text-surface-variant" aria-hidden>
                ›
              </span>
            )}
            <button
              onClick={() =>
                setActiveLegId(activeLegId === leg.id ? null : leg.id)
              }
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                activeLegId === leg.id
                  ? "bg-primary/10 font-bold text-primary"
                  : "text-on-surface-variant hover:bg-surface-warm",
              )}
            >
              {leg.destination}
            </button>
          </span>
        ))}
      </div>

      {/* Day columns */}
      <div className="flex flex-1 items-start gap-5 overflow-x-auto p-6">
        {visibleDays.map(({ leg, day, dayNumber }) => (
          <div key={day.id} className="flex w-[320px] shrink-0 flex-col gap-3">
            <div className="space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">Day {dayNumber}</span>
                <span className="text-xs font-medium text-on-surface-variant">
                  {leg.destination} · {formatDay(day.date)}
                </span>
              </div>
              {day.notes && (
                <p className="truncate text-xs italic text-on-surface-variant/70">
                  {day.notes}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {day.stops.map((stop) => (
                <StopCard key={stop.id} stop={stop} />
              ))}
              {day.stops.length === 0 && (
                <div className="rounded-xl border border-dashed border-surface-variant p-4 text-center text-xs text-on-surface-variant/60">
                  Nothing planned yet
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
