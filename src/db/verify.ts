import { eq } from "drizzle-orm";
import { placeLookup } from "@/lib/places";
import { db } from "./client";
import { days, legs, stops, trips } from "./schema";

// Trust layer (Google Places tier): resolve each AI-suggested place via the
// cached Places lookup, store its place_id + coordinates, and badge the stop
// from its live business_status:
//   OPERATIONAL / unknown → verified   (real place, open for business)
//   CLOSED_TEMPORARILY / CLOSED_PERMANENTLY → flagged (needs replan)
//   no confident match in the leg's metro → unverified (AI guess, no false flag)
// Travel-time chips + the get_travel_time copilot tool use the Routes API and
// live elsewhere — this module only does existence/status verification.

// Bias each stop search toward the leg city so a same-named place in another
// country doesn't win, and drop matches that land far outside the metro.
const MAX_DEG_FROM_ANCHOR = 0.4; // ~40km

type StopRow = typeof stops.$inferSelect;
type Bias = { lat: number; lng: number } | undefined;

// Resolve one stop against Places (biased to its leg city) and store the result:
// place_id + coords on a confident match, and a verification status from the
// live business_status. Returns the status. Shared by the trip-wide pass and
// the single-stop verify.
async function verifyStopRow(
  stop: StopRow,
  destination: string,
  bias: Bias,
  withRegion: (s: string) => string,
): Promise<"verified" | "flagged" | "unverified"> {
  const match = await placeLookup(
    withRegion(`${stop.title}, ${destination}`),
    bias,
  );

  let status: "verified" | "flagged" | "unverified" = "unverified";
  let placeId: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;

  const inMetro =
    match.found &&
    match.lat != null &&
    match.lng != null &&
    bias != null &&
    Math.abs(match.lng - bias.lng) < MAX_DEG_FROM_ANCHOR &&
    Math.abs(match.lat - bias.lat) < MAX_DEG_FROM_ANCHOR;
  // If we couldn't anchor the city, accept the match on its own merits.
  const accept = match.found && (bias == null || inMetro);

  if (accept) {
    placeId = match.placeId;
    lat = match.lat;
    lng = match.lng;
    status =
      match.businessStatus === "CLOSED_PERMANENTLY" ||
      match.businessStatus === "CLOSED_TEMPORARILY"
        ? "flagged"
        : "verified"; // OPERATIONAL or unknown — a real, operating place.
  }

  await db
    .update(stops)
    .set({ verification: status, verifiedAt: new Date(), placeId, lat, lng })
    .where(eq(stops.id, stop.id));

  return status;
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
    const anchor = await placeLookup(withRegion(leg.destination));
    const bias =
      anchor.found && anchor.lat != null && anchor.lng != null
        ? { lat: anchor.lat, lng: anchor.lng }
        : undefined;
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

        const status = await verifyStopRow(s, leg.destination, bias, withRegion);
        if (status === "verified") verified++;
        else if (status === "flagged") flagged++;
        else unconfirmed++;
      }
    }
  }

  return { checked, verified, flagged, unconfirmed };
}

// Verify a single stop (the per-card "Verify" action). Anchors to the stop's
// own leg city and resolves just that place. Unlike the trip-wide pass this
// doesn't filter by source, so a traveler can also confirm their own "Your
// pick" places. Returns the resulting status, or null if it couldn't run.
export async function verifyStopById(
  stopId: string,
): Promise<{ status: "verified" | "flagged" | "unverified" } | null> {
  if (!process.env.GOOGLE_MAPS_API_KEY) return null;

  const stop = await db.query.stops.findFirst({ where: eq(stops.id, stopId) });
  if (!stop) return null;

  const day = await db.query.days.findFirst({ where: eq(days.id, stop.dayId) });
  if (!day) return null;
  const leg = await db.query.legs.findFirst({ where: eq(legs.id, day.legId) });
  if (!leg) return null;
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, leg.tripId) });

  const region =
    (trip?.preferences as { destination?: string | null } | null)
      ?.destination ?? null;
  const withRegion = (s: string) => (region ? `${s}, ${region}` : s);

  const anchor = await placeLookup(withRegion(leg.destination));
  const bias =
    anchor.found && anchor.lat != null && anchor.lng != null
      ? { lat: anchor.lat, lng: anchor.lng }
      : undefined;

  const status = await verifyStopRow(stop, leg.destination, bias, withRegion);
  return { status };
}
