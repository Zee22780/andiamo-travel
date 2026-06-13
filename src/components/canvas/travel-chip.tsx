"use client";

import type { TravelLeg } from "@/lib/routes";

// Tiny pill between two stop cards: real Routes API travel time + mode.
// Design system §5: white pill, border-surface-variant/50, "12 min walk".
export function TravelChip({ leg }: { leg: TravelLeg }) {
  const icon = leg.mode === "WALK" ? "🚶" : "🚗";
  const verb = leg.mode === "WALK" ? "walk" : "drive";
  return (
    <div className="flex justify-center">
      <span className="flex items-center gap-1 rounded-full border border-surface-variant/50 bg-white px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
        <span aria-hidden>{icon}</span>
        {leg.durationMin} min {verb}
      </span>
    </div>
  );
}
