import { notFound } from "next/navigation";
import {
  ItineraryPreview,
  PreviewItinerary,
} from "@/components/intake/itinerary-preview";
import { loadTrip } from "@/db/trips";

export const metadata = { title: "Trip — Waypoint" };

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await loadTrip(id).catch(() => null);
  if (!trip) notFound();

  const itinerary: PreviewItinerary = {
    tripName: trip.name,
    legs: trip.legs.map((leg) => ({
      destination: leg.destination,
      startDate: leg.startDate,
      endDate: leg.endDate,
      lodging: leg.lodging,
      days: leg.days.map((day) => ({
        date: day.date,
        notes: day.notes,
        stops: day.stops.map((stop) => ({
          type: stop.type,
          title: stop.title,
          description: stop.description,
          startTime: stop.startTime?.slice(0, 5) ?? "09:00",
          durationMin: stop.durationMin ?? 60,
          costEstimate: stop.costEstimate,
          mustDo: stop.mustDo,
        })),
      })),
    })),
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-surface-variant bg-surface-warm px-6 py-4">
        <a
          href="/"
          className="font-headline text-2xl font-black text-primary"
        >
          Waypoint
        </a>
        <a
          href="/trips/new"
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          Plan another trip
        </a>
      </header>
      <ItineraryPreview itinerary={itinerary} />
    </div>
  );
}
