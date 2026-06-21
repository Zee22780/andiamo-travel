import { CanvasStop } from "./types";

/**
 * 1-based number per *place* stop, in day order. Transit stops are journeys,
 * not destinations, so they get no number and are absent from the map. Both the
 * card badge and the map pin read from this, so they can never disagree.
 */
export function placeNumbers(stops: CanvasStop[]): Map<string, number> {
  const m = new Map<string, number>();
  let n = 0;
  for (const s of stops) if (s.type !== "transit") m.set(s.id, ++n);
  return m;
}
