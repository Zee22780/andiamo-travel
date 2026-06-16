import { notFound } from "next/navigation";
import { TripWorkspace } from "@/components/canvas/trip-workspace";
import { loadChat } from "@/db/chat";
import { loadCanvasTrip } from "@/db/trips";

export const metadata = { title: "Trip — Andiamo" };
export const dynamic = "force-dynamic";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await loadCanvasTrip(id).catch(() => null);
  if (!trip) notFound();

  const canvasTrip = trip;
  const chat = await loadChat(id).catch(() => []);
  const initialChat = chat.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const fmtDate = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const dateRange = trip.legs.length
    ? `${fmtDate(trip.legs[0].startDate)} → ${fmtDate(
        trip.legs[trip.legs.length - 1].endDate,
      )}`
    : "";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-col items-center gap-3 border-b border-surface-variant bg-surface-warm px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <a href="/" className="font-headline text-2xl font-black text-primary">
            Andiamo
          </a>
          <div className="hidden h-6 w-px bg-surface-variant sm:block" />
          <div className="flex flex-col text-center sm:text-left">
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
          className="w-full rounded-full bg-primary px-5 py-2 text-center text-sm font-bold text-white hover:opacity-90 sm:w-auto"
        >
          Plan another trip
        </a>
      </header>
      <TripWorkspace
        trip={canvasTrip}
        mapKey={process.env.MAPTILER_KEY ?? null}
        initialChat={initialChat}
      />
    </div>
  );
}
