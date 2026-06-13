// Day-pacing heuristic for the trust layer's "overpacked day" detection.
// Pure/derived — no external calls. Travel-time between stops (Routes API) is a
// P2 enhancement; for now we reason from stop count + committed active minutes.

import type { CanvasStop } from "./types";

export type Pace = "relaxed" | "balanced" | "packed";

// Upper comfort bounds per pace: max active minutes and max non-lodging stops
// in a single day before it reads as overpacked.
const PACE_BUDGET: Record<Pace, { maxMin: number; maxStops: number }> = {
  relaxed: { maxMin: 300, maxStops: 4 },
  balanced: { maxMin: 480, maxStops: 6 },
  packed: { maxMin: 660, maxStops: 8 },
};

export function dayPacing(stops: CanvasStop[], pace: Pace | null) {
  const effective = pace ?? "balanced";
  const budget = PACE_BUDGET[effective];
  // Lodging isn't "active" time; everything else counts toward the day's load.
  const active = stops.filter((s) => s.type !== "lodging");
  const activeMin = active.reduce((n, s) => n + (s.durationMin ?? 0), 0);
  const stopCount = active.length;
  const overpacked =
    activeMin > budget.maxMin || stopCount > budget.maxStops;
  return { overpacked, activeMin, stopCount, pace: effective, budget };
}
