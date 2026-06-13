"use client";

import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DayColumn } from "./day-column";
import { dayPacing } from "./pacing";
import { StopCard } from "./stop-card";
import { CanvasLeg, CanvasDay, CanvasStop, CanvasTrip } from "./types";
import { CanvasDndState } from "./use-canvas-dnd";

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TripCanvas({
  trip,
  dnd,
  activeLegId,
  onSetLeg,
  focusedDayId,
  onFocusDay,
  onAskCopilot,
  onVerify,
  verifying,
}: {
  trip: CanvasTrip;
  dnd: CanvasDndState;
  activeLegId: string | null;
  onSetLeg: (id: string | null) => void;
  focusedDayId: string | null;
  onFocusDay: (id: string) => void;
  onAskCopilot: (prompt: string) => void;
  onVerify: () => void;
  verifying: boolean;
}) {
  const {
    dayStops,
    activeStop,
    sensors,
    onDragStart,
    onDragOver,
    onDragEnd,
    addStop,
    updateStop,
    deleteStop,
  } = dnd;

  const allDays = useMemo(
    () =>
      trip.legs.flatMap((leg, li) =>
        leg.days.map((day, di) => ({
          leg,
          day,
          dayNumber:
            trip.legs.slice(0, li).reduce((n, l) => n + l.days.length, 0) +
            di +
            1,
        })),
      ),
    [trip],
  );

  const visibleDays = activeLegId
    ? allDays.filter(({ leg }) => leg.id === activeLegId)
    : allDays;

  // Build a concrete, day-scoped trim request the copilot can act on
  // surgically (it resolves ids via get_trip_state).
  const askFixDay = (
    leg: CanvasLeg,
    day: CanvasDay,
    dayNumber: number,
    stops: CanvasStop[],
  ) => {
    const p = dayPacing(stops, trip.pace);
    const hrs =
      p.activeMin > 0 ? `about ${Math.round(p.activeMin / 60)} hours across ` : "";
    onAskCopilot(
      `Day ${dayNumber} (${leg.destination}, ${formatDay(day.date)}) is overpacked for a ${p.pace} pace — ${hrs}${p.stopCount} stops. Trim it to a comfortable ${p.pace} day by removing or shortening the least essential stops. Never remove anything marked must-do.`,
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Leg bar */}
      <div className="flex items-center gap-2 border-b border-surface-variant bg-white px-6 py-3">
        <span className="mr-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant/50">
          Route
        </span>
        <button
          onClick={() => onSetLeg(null)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            activeLegId === null
              ? "bg-primary/10 font-bold text-primary"
              : "text-on-surface-variant hover:bg-surface-warm",
          )}
        >
          All
        </button>
        {trip.legs.map((leg) => (
          <span key={leg.id} className="flex items-center gap-2">
            <span className="text-sm text-surface-variant" aria-hidden>
              ›
            </span>
            <button
              onClick={() => onSetLeg(activeLegId === leg.id ? null : leg.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                activeLegId === leg.id
                  ? "bg-primary/10 font-bold text-primary"
                  : "text-on-surface-variant hover:bg-surface-warm",
              )}
            >
              {leg.destination}
            </button>
          </span>
        ))}
        <button
          onClick={onVerify}
          disabled={verifying}
          title="Check that AI-suggested places resolve to a real location"
          className="ml-auto rounded-lg border border-primary/30 px-3 py-1.5 text-sm font-bold text-primary transition-all hover:bg-primary/5 disabled:opacity-60"
        >
          {verifying ? "Verifying…" : "✓ Verify places"}
        </button>
      </div>

      {/* Day columns */}
      <DndContext
        id="trip-canvas-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 items-start gap-5 overflow-x-auto p-6">
          {visibleDays.map(({ leg, day, dayNumber }) => (
            <DayColumn
              key={day.id}
              leg={leg}
              day={day}
              dayNumber={dayNumber}
              stops={dayStops[day.id] ?? []}
              dateLabel={formatDay(day.date)}
              pace={trip.pace}
              focused={focusedDayId === day.id}
              onFocus={() => onFocusDay(day.id)}
              onAddStop={addStop}
              onUpdateStop={updateStop}
              onDeleteStop={deleteStop}
              onFixDay={() =>
                askFixDay(leg, day, dayNumber, dayStops[day.id] ?? [])
              }
            />
          ))}
        </div>
        <DragOverlay>
          {activeStop ? <StopCard stop={activeStop} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
