import { notFound } from "next/navigation";
import { TripWorkspace } from "@/components/canvas/trip-workspace";
import { CanvasTrip } from "@/components/canvas/types";
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

  const canvasTrip: CanvasTrip = {
    id: trip.id,
    name: trip.name,
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
          costEstimate: stop.costEstimate,
          mustDo: stop.mustDo,
        })),
      })),
    })),
  };

  const dateRange = trip.legs.length
    ? `${trip.legs[0].startDate} → ${trip.legs[trip.legs.length - 1].endDate}`
    : "";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-surface-variant bg-surface-warm px-6 py-3">
        <div className="flex items-center gap-4">
          <a href="/" className="font-headline text-2xl font-black text-primary">
            Waypoint
          </a>
          <div className="h-6 w-px bg-surface-variant" />
          <div className="flex flex-col">
            <h1 className="font-headline text-lg font-semibold leading-tight">
              {trip.name}
            </h1>
            <span className="text-xs font-medium text-on-surface-variant">
              {dateRange}
            </span>
          </div>
        </div>
        <a
          href="/trips/new"
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          Plan another trip
        </a>
      </header>
      <TripWorkspace trip={canvasTrip} mapKey={process.env.MAPTILER_KEY ?? null} />
    </div>
  );
}
