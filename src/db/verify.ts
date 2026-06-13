import { eq } from "drizzle-orm";
import { db } from "./client";
import { days, legs, stops, trips } from "./schema";

// Trust layer (MapTiler tier): confirm AI-suggested places resolve to a real
// location near the leg's city, store their coordinates, and badge each stop
// Verified / Flagged. Opening hours + business_status + travel-time need a POI/
// routing provider (e.g. Google Places/Routes) and are deferred — see PLAN.md.

type LngLat = [number, number];

async function mtGeocode(
  query: string,
): Promise<{ center: LngLat; relevance: number } | null> {
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
    query,
  )}.json?key=${process.env.MAPTILER_KEY}&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { center?: LngLat; relevance?: number }[];
    };
    const f = data.features?.[0];
    if (!f?.center) return null;
    return { center: f.center, relevance: f.relevance ?? 0 };
  } catch {
    return null;
  }
}

// A confident match: the geocoder is reasonably sure AND the result sits inside
// the leg city's metro area (not a same-named place elsewhere).
const MIN_RELEVANCE = 0.8;
const MAX_DEG_FROM_ANCHOR = 0.2; // ~20km — within the destination metro
// When the geocoder can't find a POI it falls back to the city centroid (≈ the
// anchor itself). That's not a real match — treat it as not found.
const CENTROID_EPSILON = 0.01; // ~1km

export async function verifyTripPlaces(
  tripId: string,
): Promise<{ checked: number; verified: number; unconfirmed: number }> {
  const empty = { checked: 0, verified: 0, unconfirmed: 0 };
  if (!process.env.MAPTILER_KEY) return empty;

  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) return empty;
  const region =
    (trip.preferences as { destination?: string | null } | null)?.destination ??
    null;
  const withRegion = (s: string) => (region ? `${s}, ${region}` : s);

  const tripLegs = await db.query.legs.findMany({
    where: eq(legs.tripId, tripId),
  });

  let checked = 0;
  let verified = 0;
  let unconfirmed = 0;

  for (const leg of tripLegs) {
    const anchor = await mtGeocode(withRegion(leg.destination));
    const legDays = await db.query.days.findMany({
      where: eq(days.legId, leg.id),
    });
    for (const day of legDays) {
      const dayStops = await db.query.stops.findMany({
        where: eq(stops.dayId, day.id),
      });
      for (const s of dayStops) {
        // Only verify places the AI proposed that you actually visit. Leave
        // user-edited stops and transit/lodging notes untouched.
        if (s.source !== "ai") continue;
        if (s.type !== "activity" && s.type !== "meal") continue;
        checked++;

        const g = await mtGeocode(withRegion(`${s.title}, ${leg.destination}`));
        // Promote to verified only on a confident, in-metro, non-centroid
        // match. Anything we can't confirm stays "unverified" (AI guess) — we
        // don't flag it, because MapTiler not finding a POI doesn't mean the
        // place is bad. Genuine flagging (closed/nonexistent) needs a Places
        // API — deferred. See PLAN.md.
        let status: "verified" | "unverified" = "unverified";
        let lat: number | null = null;
        let lng: number | null = null;
        if (g && anchor) {
          const dLng = Math.abs(g.center[0] - anchor.center[0]);
          const dLat = Math.abs(g.center[1] - anchor.center[1]);
          const isCentroidFallback =
            dLng < CENTROID_EPSILON && dLat < CENTROID_EPSILON;
          const inMetro =
            dLng < MAX_DEG_FROM_ANCHOR && dLat < MAX_DEG_FROM_ANCHOR;
          if (g.relevance >= MIN_RELEVANCE && inMetro && !isCentroidFallback) {
            status = "verified";
            [lng, lat] = g.center;
          }
        }
        if (status === "verified") verified++;
        else unconfirmed++;

        await db
          .update(stops)
          .set({ verification: status, verifiedAt: new Date(), lat, lng })
          .where(eq(stops.id, s.id));
      }
    }
  }

  return { checked, verified, unconfirmed };
}
