// Google Places (New) Place Photos. Resolves a displayable image URI from
// either a place_id (verified stops) or a free-text query (a city/destination),
// keeping the API key server-side. Two Google calls per cold lookup — get the
// photo resource name (Place Details / Text Search), then the media URI — so
// results are cached in-process; the proxy route additionally sets HTTP cache
// headers and the browser caches the actual image bytes from googleusercontent.

const PLACES = "https://places.googleapis.com/v1";

type Cached = { uri: string | null; exp: number };
const cache = new Map<string, Cached>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — media URIs are short-lived; browsers cache the bytes

const key = () => process.env.GOOGLE_MAPS_API_KEY;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

async function photoNameForPlaceId(placeId: string): Promise<string | null> {
  const k = key();
  if (!k) return null;
  try {
    const res = await fetch(`${PLACES}/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": k, "X-Goog-FieldMask": "photos" },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { photos?: { name?: string }[] };
    return d.photos?.[0]?.name ?? null;
  } catch {
    return null;
  }
}

async function photoNameForQuery(query: string): Promise<string | null> {
  const k = key();
  if (!k) return null;
  try {
    const res = await fetch(`${PLACES}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": k,
        "X-Goog-FieldMask": "places.photos",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      places?: { photos?: { name?: string }[] }[];
    };
    return d.places?.[0]?.photos?.[0]?.name ?? null;
  } catch {
    return null;
  }
}

async function mediaUri(
  photoName: string,
  maxWidth: number,
): Promise<string | null> {
  const k = key();
  if (!k) return null;
  try {
    const res = await fetch(
      `${PLACES}/${photoName}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": k } },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { photoUri?: string };
    return d.photoUri ?? null;
  } catch {
    return null;
  }
}

export async function resolvePhotoUri(opts: {
  placeId?: string;
  query?: string;
  maxWidth: number;
}): Promise<string | null> {
  const base = opts.placeId ? `id:${opts.placeId}` : `q:${norm(opts.query ?? "")}`;
  const cacheKey = `${base}:${opts.maxWidth}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return hit.uri;

  const name = opts.placeId
    ? await photoNameForPlaceId(opts.placeId)
    : opts.query
      ? await photoNameForQuery(opts.query)
      : null;
  const uri = name ? await mediaUri(name, opts.maxWidth) : null;
  // Cache misses too, so an unphotographed place doesn't re-bill every render.
  cache.set(cacheKey, { uri, exp: Date.now() + TTL_MS });
  return uri;
}
