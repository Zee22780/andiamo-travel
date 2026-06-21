"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";
import { placeNumbers } from "./numbering";
import { dayPacing, type Pace } from "./pacing";
import { SortableStop } from "./sortable-stop";
import { StopDraft, StopEditor } from "./stop-editor";
import { TravelChip } from "./travel-chip";
import type { TravelLegMap } from "./use-travel-times";
import { CanvasDay, CanvasLeg, CanvasStop } from "./types";

function draftToPatch(d: StopDraft): Partial<CanvasStop> {
  return {
    title: d.title.trim(),
    type: d.type,
    startTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(d.startTime)
      ? d.startTime
      : null,
    durationMin: d.durationMin ? Number(d.durationMin) : null,
  };
}

export function DayColumn({
  leg,
  day,
  dayNumber,
  stops,
  dateLabel,
  pace,
  focused,
  onFocus,
  onAddStop,
  onUpdateStop,
  onDeleteStop,
  onVerifyStop,
  verifyingStopId,
  onFixDay,
  travelLegs,
}: {
  leg: CanvasLeg;
  day: CanvasDay;
  dayNumber: number;
  stops: CanvasStop[];
  dateLabel: string;
  pace: Pace | null;
  focused: boolean;
  onFocus: () => void;
  onAddStop: (dayId: string, fields: { title: string; type: CanvasStop["type"] }) => void;
  onUpdateStop: (stopId: string, patch: Partial<CanvasStop>) => void;
  onDeleteStop: (stopId: string) => void;
  onVerifyStop: (stopId: string) => void;
  verifyingStopId: string | null;
  onFixDay: () => void;
  travelLegs: TravelLegMap;
}) {
  const { setNodeRef } = useDroppable({ id: day.id });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { overpacked, activeMin, stopCount } = dayPacing(stops, pace);
  // Numbers track *places*, not transit; shared with the map so they match.
  const nums = placeNumbers(stops);

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[320px]">
      <button
        onClick={onFocus}
        className={cn(
          "space-y-0.5 rounded-lg border px-2 py-1.5 text-left transition-all",
          focused
            ? "border-primary/30 bg-primary/5"
            : "border-transparent hover:bg-white",
        )}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">Day {dayNumber}</span>
          <span className="text-xs font-medium text-on-surface-variant">
            {leg.destination} · {dateLabel}
          </span>
        </div>
        {day.notes && (
          <p className="truncate text-xs italic text-on-surface-variant/70">
            {day.notes}
          </p>
        )}
      </button>

      {overpacked && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5">
          <span className="text-xs font-semibold text-accent">
            Overpacked · {stopCount} stops
            {activeMin > 0 ? `, ~${Math.round(activeMin / 60)}h` : ""}
          </span>
          <button
            onClick={onFixDay}
            className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
          >
            Fix this day
          </button>
        </div>
      )}

      <SortableContext
        items={stops.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
          {stops.map((stop, i) => {
            const next = stops[i + 1];
            const leg = next ? travelLegs[`${stop.id}->${next.id}`] : null;
            return (
              <Fragment key={stop.id}>
                {editingId === stop.id ? (
                  <StopEditor
                    initial={{
                      title: stop.title,
                      type: stop.type,
                      startTime: stop.startTime ?? "",
                      durationMin: stop.durationMin?.toString() ?? "",
                    }}
                    onSave={(d) => {
                      onUpdateStop(stop.id, draftToPatch(d));
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <SortableStop
                    stop={stop}
                    index={nums.get(stop.id)}
                    onEdit={() => setEditingId(stop.id)}
                    onDelete={() => onDeleteStop(stop.id)}
                    onVerify={() => onVerifyStop(stop.id)}
                    verifying={verifyingStopId === stop.id}
                  />
                )}
                {leg && <TravelChip leg={leg} />}
              </Fragment>
            );
          })}
          {stops.length === 0 && !adding && (
            <div className="rounded-xl border border-dashed border-surface-variant p-4 text-center text-xs text-on-surface-variant/60">
              Drop a stop here
            </div>
          )}
        </div>
      </SortableContext>

      {adding ? (
        <StopEditor
          onSave={(d) => {
            onAddStop(day.id, { title: d.title.trim(), type: d.type });
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg border border-dashed border-surface-variant py-2 text-xs font-medium text-on-surface-variant/70 transition-colors hover:border-primary/40 hover:text-primary"
        >
          + Add stop
        </button>
      )}
    </div>
  );
}
