import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Lightweight geocoding seam: turns stop titles into coordinates so the map
// can show pins before the P2 verification layer fills stops.lat/lng from
// Google Places. Replace the source here when P2 lands; the shape stays.

const BodySchema = z.object({
  near: z.string().optional(), // bias context, e.g. "Kyoto, Japan"
  items: z
    .array(z.object({ id: z.string(), query: z.string() }))
    .min(1)
    .max(50),
});

type LngLat = [number, number];

// Process-lifetime cache keyed by query string. Cheap protection against
// re-geocoding the same stop on every canvas render.
const cache = new Map<string, LngLat | null>();

async function geocode(query: string, near?: string): Promise<LngLat | null> {
  const key = near ? `${query} @ ${near}` : query;
  if (cache.has(key)) return cache.get(key)!;

  const search = near ? `${query}, ${near}` : query;
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
    search,
  )}.json?key=${process.env.MAPTILER_KEY}&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const data = (await res.json()) as {
      features?: { center?: LngLat }[];
    };
    const center = data.features?.[0]?.center ?? null;
    cache.set(key, center);
    return center;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.MAPTILER_KEY) {
    return NextResponse.json({ error: "maps not configured" }, { status: 503 });
  }
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { near, items } = parsed.data;

  const results = await Promise.all(
    items.map(async ({ id, query }) => ({
      id,
      center: await geocode(query, near),
    })),
  );

  const coords: Record<string, LngLat> = {};
  for (const { id, center } of results) {
    if (center) coords[id] = center;
  }
  return NextResponse.json({ coords });
}
