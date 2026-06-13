"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SortableStop } from "./sortable-stop";
import { StopDraft, StopEditor } from "./stop-editor";
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
  focused,
  onFocus,
  onAddStop,
  onUpdateStop,
  onDeleteStop,
}: {
  leg: CanvasLeg;
  day: CanvasDay;
  dayNumber: number;
  stops: CanvasStop[];
  dateLabel: string;
  focused: boolean;
  onFocus: () => void;
  onAddStop: (dayId: string, fields: { title: string; type: CanvasStop["type"] }) => void;
  onUpdateStop: (stopId: string, patch: Partial<CanvasStop>) => void;
  onDeleteStop: (stopId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: day.id });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex w-[320px] shrink-0 flex-col gap-3">
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

      <SortableContext
        items={stops.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
          {stops.map((stop) =>
            editingId === stop.id ? (
              <StopEditor
                key={stop.id}
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
                key={stop.id}
                stop={stop}
                onEdit={() => setEditingId(stop.id)}
                onDelete={() => onDeleteStop(stop.id)}
              />
            ),
          )}
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
