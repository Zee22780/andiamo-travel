import { asc, desc, eq, sql } from "drizzle-orm";
import type { Itinerary, TripSummary } from "@/lib/ai/schemas";
import { db, DEMO_PROFILE_ID, ensureDemoProfile } from "./client";
import { days, legs, stops, tripMembers, trips } from "./schema";

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

export async function saveItinerary(
  itinerary: Itinerary,
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
              source: "ai" as const,
            })),
          );
        }
      }
    }

    return trip.id;
  });
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
