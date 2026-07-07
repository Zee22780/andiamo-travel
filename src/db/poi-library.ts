import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { InlineStop, Itinerary, RefStop } from "@/lib/ai/schemas";
import { isRefStop } from "@/lib/ai/schemas";
import { db } from "./client";
import { poiLibrary, stops } from "./schema";

// Destination place library backing reference-based generation. Rows are
// promoted from Places-verified AI stops; generation injects a compact
// per-destination catalog ("Known places") and the model schedules those
// places by slug. resolveItinerary() expands the slugs back into full stops
// that arrive pre-verified (place_id + coords already known).

export type PoiRow = typeof poiLibrary.$inferSelect;
type StopRow = typeof stops.$inferSelect;

// A stop after reference resolution: the inline shape plus the verification
// fields a library hit already carries. saveItinerary persists these directly.
export type ResolvedStop = InlineStop & {
  placeId?: string;
  lat?: number;
  lng?: number;
  verification?: "verified";
  verifiedAt?: Date;
};

export type ResolvedItinerary = Omit<Itinerary, "legs"> & {
  legs: (Omit<Itinerary["legs"][number], "days"> & {
    days: (Omit<Itinerary["legs"][number]["days"][number], "stops"> & {
      stops: ResolvedStop[];
    })[];
  })[];
};

export const normalizeDestination = (d: string) => d.trim().toLowerCase();

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const poiSlug = (destination: string, title: string) =>
  `${slugify(destination)}/${slugify(title)}`;

// Promote a verified stop into the library. Gated to AI-authored activity/meal
// stops with a confident Places match — user picks and transit/lodging never
// enter the shared library. Descriptions ride along from the generating trip;
// they read as general place blurbs in practice. Never throws: promotion is a
// side effect of verification and must not break it.
export async function promoteStopToLibrary(
  stop: Pick<
    StopRow,
    "source" | "type" | "title" | "description" | "durationMin" | "costEstimate"
  >,
  legDestination: string,
  match: { placeId: string | null; lat: number | null; lng: number | null },
): Promise<void> {
  if (stop.source !== "ai") return;
  if (stop.type !== "activity" && stop.type !== "meal") return;
  if (!match.placeId || match.lat == null || match.lng == null) return;

  const destination = normalizeDestination(legDestination);
  try {
    const existing = await db.query.poiLibrary.findFirst({
      where: and(
        eq(poiLibrary.destination, destination),
        eq(poiLibrary.placeId, match.placeId),
      ),
    });
    if (existing) {
      // Refresh coords + recency; keep the original slug/title/description so
      // prompts stay stable.
      await db
        .update(poiLibrary)
        .set({ lat: match.lat, lng: match.lng, lastVerifiedAt: new Date() })
        .where(eq(poiLibrary.slug, existing.slug));
      return;
    }
    await db
      .insert(poiLibrary)
      .values({
        slug: poiSlug(destination, stop.title),
        destination,
        type: stop.type,
        title: stop.title,
        description: stop.description,
        typicalDurationMin: stop.durationMin,
        costEstimate: stop.costEstimate,
        placeId: match.placeId,
        lat: match.lat,
        lng: match.lng,
        lastVerifiedAt: new Date(),
      })
      // Same slug, different place (title collision): keep the first.
      .onConflictDoNothing();
  } catch {
    // Library promotion is best-effort; verification already succeeded.
  }
}

const CATALOG_CAP_PER_DESTINATION = 40;

// Library rows for a trip's destinations, most-used first. Destination match
// is exact on the normalized string plus a loose containment fallback so
// "Porto, Portugal" (intake) still finds rows stored as "porto" (leg).
export async function loadCatalog(destinations: string[]): Promise<PoiRow[]> {
  const wanted = [...new Set(destinations.map(normalizeDestination))].filter(
    Boolean,
  );
  if (wanted.length === 0) return [];

  const seen = new Set<string>();
  const catalog: PoiRow[] = [];
  for (const dest of wanted) {
    const rows = await db
      .select()
      .from(poiLibrary)
      .where(
        sql`${poiLibrary.destination} = ${dest}
          or ${dest} like '%' || ${poiLibrary.destination} || '%'
          or ${poiLibrary.destination} like '%' || ${dest} || '%'`,
      )
      .orderBy(desc(poiLibrary.timesUsed), asc(poiLibrary.createdAt))
      .limit(CATALOG_CAP_PER_DESTINATION);
    for (const row of rows) {
      if (!seen.has(row.slug)) {
        seen.add(row.slug);
        catalog.push(row);
      }
    }
  }
  return catalog;
}

// One prompt line per place: slug | type | title | ~Nmin. ~10-15 tokens each.
export function catalogPromptBlock(catalog: PoiRow[]): string {
  if (catalog.length === 0) return "";
  const lines = catalog.map(
    (p) =>
      `${p.slug} | ${p.type} | ${p.title} | ~${p.typicalDurationMin ?? 90}min`,
  );
  return `Known places — real, verified places you may schedule by reference. To use one, emit a stop of the form {"poi": "<slug>", "startTime": …, "durationMin": …, "mustDo": …, "userAdded": …} instead of writing the stop out; details are filled in from the catalog. Only use slugs listed here, and never invent one:\n${lines.join("\n")}`;
}

const humanizeSlug = (slug: string) =>
  (slug.split("/").pop() ?? slug).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Expand reference stops into full stops using the catalog. Pure — no DB
// writes — so it can run on streamed partials too; call recordCatalogUse()
// once with the returned usedSlugs when the itinerary is actually saved.
// Unknown slugs degrade to an inline unverified stop so a hallucinated
// reference can never crash generation.
export function resolveItinerary(
  itinerary: Itinerary,
  catalog: PoiRow[],
): { itinerary: ResolvedItinerary; usedSlugs: string[]; unknownSlugs: string[] } {
  const bySlug = new Map(catalog.map((p) => [p.slug, p]));
  const usedSlugs: string[] = [];
  const unknownSlugs: string[] = [];

  const resolveStop = (stop: InlineStop | RefStop): ResolvedStop => {
    if (!isRefStop(stop)) return stop;
    const row = bySlug.get(stop.poi);
    if (!row) {
      unknownSlugs.push(stop.poi);
      return {
        type: "activity",
        title: humanizeSlug(stop.poi),
        description: null,
        startTime: stop.startTime,
        durationMin: stop.durationMin ?? 90,
        costEstimate: null,
        mustDo: stop.mustDo,
        userAdded: stop.userAdded,
      };
    }
    usedSlugs.push(row.slug);
    return {
      type: row.type as "activity" | "meal",
      title: row.title,
      description: row.description,
      startTime: stop.startTime,
      durationMin: stop.durationMin ?? row.typicalDurationMin ?? 90,
      costEstimate: row.costEstimate,
      mustDo: stop.mustDo,
      userAdded: stop.userAdded,
      placeId: row.placeId,
      lat: row.lat,
      lng: row.lng,
      verification: "verified",
      verifiedAt: new Date(),
    };
  };

  return {
    itinerary: {
      ...itinerary,
      legs: itinerary.legs.map((leg) => ({
        ...leg,
        days: leg.days.map((day) => ({
          ...day,
          stops: day.stops.map(resolveStop),
        })),
      })),
    },
    usedSlugs,
    unknownSlugs,
  };
}

// Popularity signal for catalog ordering; called once per saved itinerary.
export async function recordCatalogUse(slugs: string[]): Promise<void> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return;
  try {
    await db
      .update(poiLibrary)
      .set({ timesUsed: sql`${poiLibrary.timesUsed} + 1` })
      .where(inArray(poiLibrary.slug, unique));
  } catch {
    // Best-effort counter.
  }
}
