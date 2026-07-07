import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { CanvasTrip } from "@/components/canvas/types";
import type { TripSummary } from "@/lib/ai/schemas";
import { db, DEMO_PROFILE_ID, ensureDemoProfile } from "./client";
import type { ResolvedItinerary } from "./poi-library";
import { days, legs, stops, tripMembers, trips } from "./schema";
import { verifyStopById } from "./verify";

export type TripPhase = "upcoming" | "active" | "past" | "planning";

export type TripCard = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  route: string[];
  stopCount: number;
  phase: TripPhase;
};

function derivePhase(start: string | null, end: string | null): TripPhase {
  if (!start || !end) return "planning";
  const today = new Date().toISOString().slice(0, 10);
  if (today < start) return "upcoming";
  if (today > end) return "past";
  return "active";
}

export async function loadTrips(): Promise<TripCard[]> {
  const rows = await db
    .select({
      id: trips.id,
      name: trips.name,
      createdAt: trips.createdAt,
      start: sql<string | null>`min(${legs.startDate})`,
      end: sql<string | null>`max(${legs.endDate})`,
    })
    .from(trips)
    .leftJoin(legs, eq(legs.tripId, trips.id))
    .where(eq(trips.createdBy, DEMO_PROFILE_ID))
    .groupBy(trips.id)
    .orderBy(desc(trips.createdAt));

  return Promise.all(
    rows.map(async (r) => {
      const tripLegs = await db.query.legs.findMany({
        where: eq(legs.tripId, r.id),
        orderBy: asc(legs.sortOrder),
      });
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(stops)
        .innerJoin(days, eq(days.id, stops.dayId))
        .innerJoin(legs, eq(legs.id, days.legId))
        .where(eq(legs.tripId, r.id));
      return {
        id: r.id,
        name: r.name,
        startDate: r.start,
        endDate: r.end,
        route: tripLegs.map((l) => l.destination),
        stopCount: count,
        phase: derivePhase(r.start, r.end),
      };
    }),
  );
}

// Takes the reference-resolved itinerary (see db/poi-library.ts): library
// stops carry place_id/coords/verification and persist as already-verified.
export async function saveItinerary(
  itinerary: ResolvedItinerary,
  preferences: Partial<TripSummary>,
): Promise<string> {
  await ensureDemoProfile();

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({
        name: itinerary.tripName,
        preferences,
        createdBy: DEMO_PROFILE_ID,
      })
      .returning({ id: trips.id });

    await tx.insert(tripMembers).values({
      tripId: trip.id,
      userId: DEMO_PROFILE_ID,
      role: "owner",
    });

    for (const [li, leg] of itinerary.legs.entries()) {
      const [legRow] = await tx
        .insert(legs)
        .values({
          tripId: trip.id,
          destination: leg.destination,
          startDate: leg.startDate,
          endDate: leg.endDate,
          lodging: leg.lodging,
          sortOrder: li,
        })
        .returning({ id: legs.id });

      for (const day of leg.days) {
        const [dayRow] = await tx
          .insert(days)
          .values({ legId: legRow.id, date: day.date, notes: day.notes })
          .returning({ id: days.id });

        if (day.stops.length > 0) {
          await tx.insert(stops).values(
            day.stops.map((stop, si) => ({
              dayId: dayRow.id,
              type: stop.type,
              title: stop.title,
              description: stop.description,
              startTime: stop.startTime,
              durationMin: stop.durationMin,
              sortOrder: si,
              costEstimate: stop.costEstimate,
              mustDo: stop.mustDo,
              source: (stop.userAdded ? "user" : "ai") as "user" | "ai",
              // Library-referenced stops arrive pre-verified.
              placeId: stop.placeId ?? null,
              lat: stop.lat ?? null,
              lng: stop.lng ?? null,
              verification: (stop.verification ?? "unverified") as
                | "verified"
                | "unverified",
              verifiedAt: stop.verifiedAt ?? null,
            })),
          );
        }
      }
    }

    return trip.id;
  });
}

export type StopOperation =
  | {
      type: "edit";
      stopId: string;
      title?: string;
      startTime?: string;
      durationMin?: number;
      stopType?: "activity" | "meal" | "lodging" | "transit";
      mustDo?: boolean;
    }
  | { type: "move"; stopId: string; dayId?: string; sortOrder?: number }
  | { type: "delete"; stopId: string };

// Applies copilot update_stops operations. User-directed edits mark the stop
// source=user/verified (no outstanding AI claim).
export async function applyStopOperations(
  ops: StopOperation[],
): Promise<{ applied: number }> {
  let applied = 0;
  await db.transaction(async (tx) => {
    for (const op of ops) {
      if (op.type === "delete") {
        await tx.delete(stops).where(eq(stops.id, op.stopId));
        applied++;
      } else if (op.type === "move") {
        const set: Record<string, unknown> = {};
        if (op.dayId) set.dayId = op.dayId;
        if (op.sortOrder != null) set.sortOrder = op.sortOrder;
        if (Object.keys(set).length) {
          await tx.update(stops).set(set).where(eq(stops.id, op.stopId));
          applied++;
        }
      } else {
        const set: Record<string, unknown> = {
          source: "user",
          verification: "verified",
        };
        if (op.title != null) set.title = op.title;
        if (op.startTime !== undefined)
          set.startTime = op.startTime === "" ? null : op.startTime;
        if (op.durationMin != null) set.durationMin = op.durationMin;
        if (op.stopType != null) set.type = op.stopType;
        if (op.mustDo != null) set.mustDo = op.mustDo;
        await tx.update(stops).set(set).where(eq(stops.id, op.stopId));
        applied++;
      }
    }
  });
  return { applied };
}

// Insert a single stop into a day, slotting a timed stop into start-time order
// (matching the AI's time-ordered stops) and appending an untimed one. Shared
// by the manual/accepted add route and the copilot's add_stops tool.
export async function addStop(input: {
  dayId: string;
  type: "activity" | "meal" | "lodging" | "transit";
  title: string;
  startTime?: string | null;
  durationMin?: number | null;
  mustDo?: boolean;
  source?: "ai" | "user";
  verification?: "unverified" | "verified" | "flagged";
}) {
  const { dayId, type, title } = input;
  const startTime = input.startTime ?? null;

  const existing = await db
    .select({ sortOrder: stops.sortOrder, startTime: stops.startTime })
    .from(stops)
    .where(eq(stops.dayId, dayId))
    .orderBy(asc(stops.sortOrder));

  // Insert before the first stop scheduled later in the day; otherwise append.
  const maxOrder = existing.length
    ? Math.max(...existing.map((s) => s.sortOrder)) + 1
    : 0;
  const laterTimed = startTime
    ? existing.find(
        (s) => s.startTime != null && s.startTime.slice(0, 5) > startTime,
      )
    : undefined;
  const insertAt = laterTimed ? laterTimed.sortOrder : maxOrder;

  const row = await db.transaction(async (tx) => {
    if (laterTimed) {
      await tx
        .update(stops)
        .set({ sortOrder: sql`${stops.sortOrder} + 1` })
        .where(and(eq(stops.dayId, dayId), gte(stops.sortOrder, insertAt)));
    }
    const [inserted] = await tx
      .insert(stops)
      .values({
        dayId,
        type,
        title,
        startTime,
        durationMin: input.durationMin ?? null,
        sortOrder: insertAt,
        mustDo: input.mustDo ?? false,
        source: input.source ?? "ai",
        ...(input.verification ? { verification: input.verification } : {}),
      })
      .returning();
    return inserted;
  });

  // Auto-verification: resolve a place against Places the moment it enters the
  // board, so its pin/photo/status never waits for a sweep. Only visitable
  // places — transit/lodging notes aren't lookups. A personal entry that
  // doesn't resolve just stays unresolved; a Places hiccup must never fail
  // the add itself.
  if (row && (type === "activity" || type === "meal")) {
    try {
      await verifyStopById(row.id);
      const fresh = await db.query.stops.findFirst({
        where: eq(stops.id, row.id),
      });
      return fresh ?? row;
    } catch {
      // Keep the unresolved row — the canvas-mount sweep can pick it up later.
    }
  }
  return row;
}

export async function loadTrip(tripId: string) {
  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });
  if (!trip) return null;

  const tripLegs = await db.query.legs.findMany({
    where: eq(legs.tripId, tripId),
    orderBy: asc(legs.sortOrder),
  });

  const result = [];
  for (const leg of tripLegs) {
    const legDays = await db.query.days.findMany({
      where: eq(days.legId, leg.id),
      orderBy: asc(days.date),
    });
    const daysWithStops = [];
    for (const day of legDays) {
      const dayStops = await db.query.stops.findMany({
        where: eq(stops.dayId, day.id),
        orderBy: asc(stops.sortOrder),
      });
      daysWithStops.push({ ...day, stops: dayStops });
    }
    result.push({ ...leg, days: daysWithStops });
  }

  return { ...trip, legs: result };
}

// Canvas-shaped projection of a trip (client-safe field set), shared by the
// trip page and the copilot's resync endpoint.
export async function loadCanvasTrip(
  tripId: string,
): Promise<CanvasTrip | null> {
  const trip = await loadTrip(tripId);
  if (!trip) return null;
  const prefs = (trip.preferences ?? {}) as {
    destination?: string | null;
    pace?: "relaxed" | "balanced" | "packed" | null;
  };
  return {
    id: trip.id,
    name: trip.name,
    region: prefs.destination ?? null,
    pace: prefs.pace ?? null,
    legs: trip.legs.map((leg) => ({
      id: leg.id,
      destination: leg.destination,
      startDate: leg.startDate,
      endDate: leg.endDate,
      lodging: leg.lodging,
      days: leg.days.map((day) => ({
        id: day.id,
        date: day.date,
        notes: day.notes,
        stops: day.stops.map((stop) => ({
          id: stop.id,
          type: stop.type,
          title: stop.title,
          description: stop.description,
          startTime: stop.startTime?.slice(0, 5) ?? null,
          durationMin: stop.durationMin,
          sortOrder: stop.sortOrder,
          verification: stop.verification,
          placeId: stop.placeId,
          lat: stop.lat,
          lng: stop.lng,
          costEstimate: stop.costEstimate,
          mustDo: stop.mustDo,
          source: stop.source,
        })),
      })),
    })),
  };
}

// The trip's region/country (from intake) for disambiguating place lookups —
// e.g. "Florence" → "Florence, Italy". Light query, no leg/day/stop tree.
export async function loadTripRegion(tripId: string): Promise<string | null> {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  const prefs = (trip?.preferences ?? {}) as { destination?: string | null };
  return prefs.destination ?? null;
}
