import { asc, eq } from "drizzle-orm";
import type { Itinerary, TripSummary } from "@/lib/ai/schemas";
import { db, DEMO_PROFILE_ID, ensureDemoProfile } from "./client";
import { days, legs, stops, tripMembers, trips } from "./schema";

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
