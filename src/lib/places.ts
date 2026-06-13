import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { placesCache } from "@/db/schema";

// Google Places API (New) lookup, cached in Postgres by normalized query.
// Durable fields (existence, place_id, coords, business_status) are cached with
// a TTL; open-now is volatile and fetched live (never cached). Shared by the
// trip verify pass and the verify_place / get_travel_time copilot tools.

export type PlaceLookup = {
  found: boolean;
  placeId: string | null;
  displayName: string | null;
  businessStatus: string | null; // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY | null
  lat: number | null;
  lng: number | null;
};

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.location",
  "places.businessStatus",
  "places.displayName",
].join(",");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — existence/coords are stable
const BIAS_RADIUS_M = 25_000;

const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

async function fetchPlace(
  query: string,
  bias?: { lat: number; lng: number },
): Promise<PlaceLookup> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const miss: PlaceLookup = {
    found: false,
    placeId: null,
    displayName: null,
    businessStatus: null,
    lat: null,
    lng: null,
  };
  if (!key) return miss;
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 1 };
  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.lat, longitude: bias.lng },
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
    if (!res.ok) return miss;
    const data = (await res.json()) as {
      places?: {
        id?: string;
        location?: { latitude?: number; longitude?: number };
        businessStatus?: string;
        displayName?: { text?: string };
      }[];
    };
    const p = data.places?.[0];
    if (!p?.id || p.location?.latitude == null || p.location?.longitude == null)
      return miss;
    return {
      found: true,
      placeId: p.id,
      displayName: p.displayName?.text ?? null,
      businessStatus: p.businessStatus ?? null,
      lat: p.location.latitude,
      lng: p.location.longitude,
    };
  } catch {
    return miss;
  }
}

// Cached lookup. Returns a fresh cache hit when available, otherwise calls
// Places and upserts the result (including misses, so repeated unresolvable
// titles don't re-bill).
export async function placeLookup(
  query: string,
  bias?: { lat: number; lng: number },
): Promise<PlaceLookup> {
  const norm = normalize(query);
  const cached = await db.query.placesCache.findFirst({
    where: eq(placesCache.query, norm),
  });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return {
      found: cached.found,
      placeId: cached.placeId,
      displayName: cached.displayName,
      businessStatus: cached.businessStatus,
      lat: cached.lat,
      lng: cached.lng,
    };
  }

  const result = await fetchPlace(query, bias);
  await db
    .insert(placesCache)
    .values({ query: norm, ...result, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: placesCache.query,
      set: { ...result, fetchedAt: new Date() },
    });
  return result;
}
