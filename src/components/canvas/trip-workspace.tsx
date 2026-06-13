"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CopilotBar } from "./copilot-bar";
import { MapPane } from "./map-pane";
import { TodayView } from "./today-view";
import { TripCanvas } from "./trip-canvas";
import { CanvasTrip } from "./types";
import { buildDayStops, useCanvasDnd } from "./use-canvas-dnd";

function localTodayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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

  // Plan ↔ Today (companion) toggle. Default to Today only while the trip is
  // actually live, so planning trips open on the canvas.
  const [view, setView] = useState<"plan" | "today">(() => {
    const dates = trip.legs.flatMap((l) => l.days.map((d) => d.date)).sort();
    if (!dates.length) return "plan";
    const t = localTodayStr();
    return t >= dates[0] && t <= dates[dates.length - 1] ? "today" : "plan";
  });

  // Canvas controls (e.g. "Fix this day") send prompts to the copilot bar.
  // The incrementing `n` lets the bar fire each request, even if the text
  // repeats.
  const [copilotRequest, setCopilotRequest] = useState<{
    text: string;
    n: number;
  } | null>(null);
  const askCopilot = (text: string) =>
    setCopilotRequest((r) => ({ text, n: (r?.n ?? 0) + 1 }));

  // Trust layer: verify AI place stops against MapTiler, then resync so the
  // Verified/Flagged badges and accurate pins appear without a reload.
  const [verifying, setVerifying] = useState(false);
  const verifyPlaces = async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}/verify`, {
        method: "POST",
      });
      if (!res.ok) return;
      const state = await fetch(`/api/trips/${trip.id}/state`, {
        cache: "no-store",
      });
      if (!state.ok) return;
      const { trip: fresh } = (await state.json()) as { trip: CanvasTrip };
      dnd.resync(buildDayStops(fresh.legs.flatMap((l) => l.days)));
    } finally {
      setVerifying(false);
    }
  };

  const dnd = useCanvasDnd(
    useMemo(() => buildDayStops(trip.legs.flatMap((l) => l.days)), [trip]),
  );

  // The destination context for the focused day, for geocode biasing.
  // Append the trip's region/country so ambiguous city names resolve
  // correctly (e.g. "Florence" -> "Florence, Italy", not Florence, USA).
  const focusedNear = useMemo(() => {
    const withRegion = (city: string) =>
      trip.region ? `${city}, ${trip.region}` : city;
    for (const leg of trip.legs) {
      if (leg.days.some((d) => d.id === focusedDayId))
        return withRegion(leg.destination);
    }
    return trip.legs[0] ? withRegion(trip.legs[0].destination) : "";
  }, [trip, focusedDayId]);

  const focusedStops = focusedDayId ? (dnd.dayStops[focusedDayId] ?? []) : [];

  // Trip tree with the canvas's live stop state merged in, so the Today view
  // reflects edits made this session without a reload.
  const liveTrip = useMemo<CanvasTrip>(
    () => ({
      ...trip,
      legs: trip.legs.map((leg) => ({
        ...leg,
        days: leg.days.map((day) => ({
          ...day,
          stops: dnd.dayStops[day.id] ?? day.stops,
        })),
      })),
    }),
    [trip, dnd.dayStops],
  );

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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-center border-b border-surface-variant bg-surface-warm py-2">
        <div className="inline-flex rounded-full border border-surface-variant bg-white p-0.5">
          {(["plan", "today"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-5 py-1.5 text-sm font-bold capitalize transition-colors",
                view === v
                  ? "bg-primary text-white"
                  : "text-on-surface-variant hover:text-primary",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "today" ? (
        <TodayView trip={liveTrip} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="relative flex w-[60%] min-w-0 flex-col border-r border-surface-variant">
            <TripCanvas
              trip={trip}
              dnd={dnd}
              activeLegId={activeLegId}
              onSetLeg={setActiveLegId}
              focusedDayId={focusedDayId}
              onFocusDay={setFocusedDayId}
              onAskCopilot={askCopilot}
              onVerify={verifyPlaces}
              verifying={verifying}
            />
            <CopilotBar
              tripId={trip.id}
              dnd={dnd}
              dayLabels={dayLabels}
              initialMessages={initialChat}
              request={copilotRequest}
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
      )}
    </div>
  );
}
