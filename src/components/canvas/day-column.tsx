"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { SortableStop } from "./sortable-stop";
import { CanvasDay, CanvasLeg, CanvasStop } from "./types";

export function DayColumn({
  leg,
  day,
  dayNumber,
  stops,
  dateLabel,
  focused,
  onFocus,
}: {
  leg: CanvasLeg;
  day: CanvasDay;
  dayNumber: number;
  stops: CanvasStop[];
  dateLabel: string;
  focused: boolean;
  onFocus: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: day.id });

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
          {stops.map((stop) => (
            <SortableStop key={stop.id} stop={stop} />
          ))}
          {stops.length === 0 && (
            <div className="rounded-xl border border-dashed border-surface-variant p-4 text-center text-xs text-on-surface-variant/60">
              Drop a stop here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
