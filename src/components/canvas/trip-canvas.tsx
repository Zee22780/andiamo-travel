"use client";

import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { DayColumn } from "./day-column";
import { dayPacing } from "./pacing";
import { StopCard } from "./stop-card";
import { CanvasLeg, CanvasDay, CanvasStop, CanvasTrip } from "./types";
import { CanvasDndState } from "./use-canvas-dnd";
import type { TravelLegMap } from "./use-travel-times";

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
  onVerifyStop,
  verifyingStopId,
  travelLegs,
  isDesktop,
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
  onVerifyStop: (stopId: string) => void;
  verifyingStopId: string | null;
  travelLegs: TravelLegMap;
  isDesktop: boolean | null;
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

  // On mobile we show one day at a time. Resolve the focused entry within the
  // currently visible days, falling back to the first (e.g. after a leg filter
  // moves the focus off-screen).
  const mobileEntry =
    visibleDays.find(({ day }) => day.id === focusedDayId) ??
    visibleDays[0] ??
    null;
  const mobileIndex = mobileEntry
    ? visibleDays.findIndex(({ day }) => day.id === mobileEntry.day.id)
    : -1;

  // Keep the shared focus (which drives the map sheet) in sync with the day the
  // mobile view actually shows.
  useEffect(() => {
    if (
      isDesktop === false &&
      mobileEntry &&
      mobileEntry.day.id !== focusedDayId
    ) {
      onFocusDay(mobileEntry.day.id);
    }
  }, [isDesktop, mobileEntry, focusedDayId, onFocusDay]);

  // Desktop renders the whole board; mobile renders just the focused day. While
  // the breakpoint is still unknown (`null`), render the board so SSR and the
  // first client render agree.
  const renderedDays =
    isDesktop === false && mobileEntry ? [mobileEntry] : visibleDays;

  // Auto-scroll the active day chip into view on the mobile navigator.
  const dayNavRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isDesktop === false && dayNavRef.current) {
      const active = dayNavRef.current.querySelector<HTMLElement>(
        '[data-active="true"]',
      );
      active?.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [isDesktop, focusedDayId]);

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
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-surface-variant bg-white px-4 py-3 lg:px-6">
        <span className="mr-2 shrink-0 text-xs font-bold uppercase tracking-widest text-on-surface-variant/50">
          Route
        </span>
        <button
          onClick={() => onSetLeg(null)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            activeLegId === null
              ? "bg-primary/10 font-bold text-primary"
              : "text-on-surface-variant hover:bg-surface-warm",
          )}
        >
          All
        </button>
        {trip.legs.map((leg) => (
          <span key={leg.id} className="flex shrink-0 items-center gap-2">
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
          className="ml-auto shrink-0 rounded-lg border border-primary/30 px-3 py-1.5 text-sm font-bold text-primary transition-all hover:bg-primary/5 disabled:opacity-60"
        >
          {verifying ? "Verifying…" : "✓ Verify places"}
        </button>
      </div>

      {/* Day navigator (mobile only) — swap the single visible day. */}
      <div className="flex shrink-0 items-center gap-1 border-b border-surface-variant bg-surface-warm px-2 py-2 lg:hidden">
        <button
          onClick={() => {
            const prev = visibleDays[mobileIndex - 1];
            if (prev) onFocusDay(prev.day.id);
          }}
          disabled={mobileIndex <= 0}
          aria-label="Previous day"
          className="shrink-0 rounded-full px-2 py-1 text-on-surface-variant disabled:opacity-30"
        >
          ‹
        </button>
        <div
          ref={dayNavRef}
          className="flex flex-1 items-center gap-2 overflow-x-auto scroll-smooth"
        >
          {visibleDays.map(({ leg, day, dayNumber }) => {
            const active = mobileEntry?.day.id === day.id;
            return (
              <button
                key={day.id}
                data-active={active}
                onClick={() => onFocusDay(day.id)}
                className={cn(
                  "flex shrink-0 flex-col items-start rounded-lg px-3 py-1.5 text-left transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "bg-white text-on-surface-variant",
                )}
              >
                <span className="text-sm font-bold leading-tight">
                  Day {dayNumber}
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-tight",
                    active ? "text-white/80" : "text-on-surface-variant/70",
                  )}
                >
                  {leg.destination} · {formatDay(day.date)}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => {
            const next = visibleDays[mobileIndex + 1];
            if (next) onFocusDay(next.day.id);
          }}
          disabled={mobileIndex < 0 || mobileIndex >= visibleDays.length - 1}
          aria-label="Next day"
          className="shrink-0 rounded-full px-2 py-1 text-on-surface-variant disabled:opacity-30"
        >
          ›
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
        <div className="flex flex-1 items-start gap-4 overflow-x-auto p-4 lg:gap-5 lg:p-6">
          {renderedDays.map(({ leg, day, dayNumber }) => (
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
              onVerifyStop={onVerifyStop}
              verifyingStopId={verifyingStopId}
              onFixDay={() =>
                askFixDay(leg, day, dayNumber, dayStops[day.id] ?? [])
              }
              travelLegs={travelLegs}
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
