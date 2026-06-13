import { eq } from "drizzle-orm";
import { db } from "./client";
import { days, legs, stops, trips } from "./schema";

// Trust layer (Google Places tier): resolve each AI-suggested place against the
// Places API (New), store its place_id + coordinates, and badge the stop from
// its live business_status:
//   OPERATIONAL / unknown → verified   (real place, open for business)
//   CLOSED_TEMPORARILY / CLOSED_PERMANENTLY → flagged (needs replan)
//   no confident match in the leg's metro → unverified (AI guess, no false flag)
// Travel-time chips + the get_travel_time copilot tool use the Routes API and
// live elsewhere — this module only does existence/status verification.

type LngLat = [number, number]; // [lng, lat] — matches MapLibre + stops.lng/lat

type PlaceMatch = {
  placeId: string;
  center: LngLat;
  businessStatus: string | null; // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY | null
};

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.location",
  "places.businessStatus",
].join(",");

// Bias each stop search toward the leg city so a same-named place in another
// country doesn't win. The bias is a soft circle (~25km) around the city anchor.
const BIAS_RADIUS_M = 25_000;
// Defensive hard guard: even with the bias, drop matches that land far outside
// the metro (likely the wrong place) rather than badge them.
const MAX_DEG_FROM_ANCHOR = 0.4; // ~40km

async function placesTextSearch(
  query: string,
  bias?: LngLat,
): Promise<PlaceMatch | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 1 };
  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias[1], longitude: bias[0] },
        radius: BIAS_RADIUS_M,
      },
    };
  }
  try {
    const res = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: {
        id?: string;
        location?: { latitude?: number; longitude?: number };
        businessStatus?: string;
      }[];
    };
    const p = data.places?.[0];
    if (!p?.id || p.location?.latitude == null || p.location?.longitude == null)
      return null;
    return {
      placeId: p.id,
      center: [p.location.longitude, p.location.latitude],
      businessStatus: p.businessStatus ?? null,
    };
  } catch {
    return null;
  }
}

export async function verifyTripPlaces(
  tripId: string,
): Promise<{
  checked: number;
  verified: number;
  flagged: number;
  unconfirmed: number;
}> {
  const empty = { checked: 0, verified: 0, flagged: 0, unconfirmed: 0 };
  if (!process.env.GOOGLE_MAPS_API_KEY) return empty;

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
  let flagged = 0;
  let unconfirmed = 0;

  for (const leg of tripLegs) {
    // Anchor the leg city once, then bias every stop search toward it.
    const anchor = await placesTextSearch(withRegion(leg.destination));
    const bias = anchor?.center;
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

        const match = await placesTextSearch(
          withRegion(`${s.title}, ${leg.destination}`),
          bias,
        );

        // No match, or a match that landed outside the metro (likely a wrong
        // same-named place): stays "unverified" (AI guess). We don't flag it —
        // a missing match doesn't mean the place is bad.
        let status: "verified" | "flagged" | "unverified" = "unverified";
        let placeId: string | null = null;
        let lat: number | null = null;
        let lng: number | null = null;

        const inMetro =
          match != null &&
          bias != null &&
          Math.abs(match.center[0] - bias[0]) < MAX_DEG_FROM_ANCHOR &&
          Math.abs(match.center[1] - bias[1]) < MAX_DEG_FROM_ANCHOR;
        // If we couldn't anchor the city, accept the match on its own merits.
        const accept = match != null && (bias == null || inMetro);

        if (accept && match) {
          placeId = match.placeId;
          [lng, lat] = match.center;
          if (
            match.businessStatus === "CLOSED_PERMANENTLY" ||
            match.businessStatus === "CLOSED_TEMPORARILY"
          ) {
            status = "flagged";
          } else {
            // OPERATIONAL or unknown — it's a real, operating place.
            status = "verified";
          }
        }

        if (status === "verified") verified++;
        else if (status === "flagged") flagged++;
        else unconfirmed++;

        await db
          .update(stops)
          .set({
            verification: status,
            verifiedAt: new Date(),
            placeId,
            lat,
            lng,
          })
          .where(eq(stops.id, s.id));
      }
    }
  }

  return { checked, verified, flagged, unconfirmed };
}
