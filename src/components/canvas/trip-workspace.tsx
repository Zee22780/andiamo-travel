"use client";

import { useMemo, useState } from "react";
import { CopilotBar } from "./copilot-bar";
import { MapPane } from "./map-pane";
import { TripCanvas } from "./trip-canvas";
import { CanvasTrip } from "./types";
import { buildDayStops, useCanvasDnd } from "./use-canvas-dnd";

export function TripWorkspace({
  trip,
  mapKey,
  initialChat,
}: {
  trip: CanvasTrip;
  mapKey: string | null;
  initialChat: { role: "user" | "assistant"; content: string }[];
}) {
  const [activeLegId, setActiveLegId] = useState<string | null>(null);
  const firstDayId = trip.legs[0]?.days[0]?.id ?? null;
  const [focusedDayId, setFocusedDayId] = useState<string | null>(firstDayId);

  const dnd = useCanvasDnd(
    useMemo(() => buildDayStops(trip.legs.flatMap((l) => l.days)), [trip]),
  );

  // The destination context for the focused day, for geocode biasing.
  const focusedNear = useMemo(() => {
    for (const leg of trip.legs) {
      if (leg.days.some((d) => d.id === focusedDayId)) return leg.destination;
    }
    return trip.legs[0]?.destination ?? "";
  }, [trip, focusedDayId]);

  const focusedStops = focusedDayId ? (dnd.dayStops[focusedDayId] ?? []) : [];

  // dayId -> "Destination · date" for suggestion cards
  const dayLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const leg of trip.legs) {
      for (const day of leg.days) {
        out[day.id] = `${leg.destination} · ${new Date(
          `${day.date}T12:00:00`,
        ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      }
    }
    return out;
  }, [trip]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative flex w-[60%] min-w-0 flex-col border-r border-surface-variant">
        <TripCanvas
          trip={trip}
          dnd={dnd}
          activeLegId={activeLegId}
          onSetLeg={setActiveLegId}
          focusedDayId={focusedDayId}
          onFocusDay={setFocusedDayId}
        />
        <CopilotBar
          tripId={trip.id}
          dnd={dnd}
          dayLabels={dayLabels}
          initialMessages={initialChat}
        />
      </div>
      <div className="relative w-[40%]">
        {mapKey ? (
          <MapPane mapKey={mapKey} stops={focusedStops} near={focusedNear} />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-warm p-6 text-center text-sm text-on-surface-variant/60">
            Add a MapTiler key to enable the map.
          </div>
        )}
      </div>
    </div>
  );
}
