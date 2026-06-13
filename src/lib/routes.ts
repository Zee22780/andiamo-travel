// Routes API (Google Maps Platform) client for travel-time chips between
// consecutive stops. Each pair is one computeRoutes call; results are cached
// in-process keyed by rounded coords + mode (routes between fixed points don't
// change, so this keeps Routes billing sane across repeated canvas renders).

export type TravelMode = "WALK" | "DRIVE";
export type LatLng = { lat: number; lng: number };
export type TravelLeg = {
  durationMin: number;
  distanceMeters: number;
  mode: TravelMode;
};

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const cache = new Map<string, { value: TravelLeg | null; at: number }>();

// Walk for short hops; switch to driving once the straight-line gap is big
// enough that a 40-minute walk is implausible (≈2.5km as the crow flies).
const WALK_MAX_KM = 2.5;

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function key(from: LatLng, to: LatLng, mode: TravelMode): string {
  const r = (n: number) => n.toFixed(4); // ~11m precision
  return `${mode}:${r(from.lat)},${r(from.lng)}->${r(to.lat)},${r(to.lng)}`;
}

async function computeOne(
  from: LatLng,
  to: LatLng,
): Promise<TravelLeg | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const mode: TravelMode = haversineKm(from, to) > WALK_MAX_KM ? "DRIVE" : "WALK";

  const cacheKey = key(from, to, mode);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: mode,
      }),
    });
    if (!res.ok) {
      cache.set(cacheKey, { value: null, at: Date.now() });
      return null;
    }
    const data = (await res.json()) as {
      routes?: { duration?: string; distanceMeters?: number }[];
    };
    const r = data.routes?.[0];
    if (!r?.duration) {
      cache.set(cacheKey, { value: null, at: Date.now() });
      return null;
    }
    const seconds = parseInt(r.duration.replace("s", ""), 10);
    const leg: TravelLeg = {
      durationMin: Math.max(1, Math.round(seconds / 60)),
      distanceMeters: r.distanceMeters ?? 0,
      mode,
    };
    cache.set(cacheKey, { value: leg, at: Date.now() });
    return leg;
  } catch {
    return null;
  }
}

// Batch: resolve many pairs concurrently, returning a map keyed by the caller's
// own pair key (so the canvas can map results back to stop-id pairs).
export async function travelTimes(
  pairs: { key: string; from: LatLng; to: LatLng }[],
): Promise<Record<string, TravelLeg | null>> {
  const out: Record<string, TravelLeg | null> = {};
  await Promise.all(
    pairs.map(async (p) => {
      out[p.key] = await computeOne(p.from, p.to);
    }),
  );
  return out;
}
