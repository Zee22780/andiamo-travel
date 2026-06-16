"use client";

import type { TravelLeg } from "@/lib/routes";

// Tiny pill between two stop cards: real Routes API travel time + mode.
// Tinted electric blue — the palette's "movement" accent (like a map route
// line), distinct from teal actions and terracotta warnings.
export function TravelChip({ leg }: { leg: TravelLeg }) {
  const icon = leg.mode === "WALK" ? "🚶" : "🚗";
  const verb = leg.mode === "WALK" ? "walk" : "drive";
  return (
    <div className="flex justify-center">
      <span className="flex items-center gap-1 rounded-full border border-electric/30 bg-electric/5 px-2 py-0.5 text-[10px] font-semibold text-electric">
        <span aria-hidden>{icon}</span>
        {leg.durationMin} min {verb}
      </span>
    </div>
  );
}
