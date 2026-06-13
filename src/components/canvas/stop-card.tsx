"use client";

import { cn } from "@/lib/utils";
import { CanvasStop } from "./types";

const TYPE_ICONS: Record<CanvasStop["type"], string> = {
  activity: "🏛️",
  meal: "🍽️",
  lodging: "🛏️",
  transit: "🚆",
};

export function VerificationBadge({
  verification,
}: {
  verification: CanvasStop["verification"];
}) {
  if (verification === "verified") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
        ✓ Verified
      </span>
    );
  }
  if (verification === "flagged") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
        Needs replan
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
      AI guess
    </span>
  );
}

export function StopCard({
  stop,
  dragging,
  onEdit,
  onDelete,
}: {
  stop: CanvasStop;
  dragging?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  // Buttons must swallow pointerdown so they don't start a drag.
  const stop_ = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        dragging && "rotate-1 shadow-xl ring-2 ring-primary/30",
      )}
    >
      {(onEdit || onDelete) && (
        <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex">
          {onEdit && (
            <button
              onPointerDown={stop_}
              onClick={onEdit}
              aria-label="Edit stop"
              className="rounded-md p-1 text-on-surface-variant/60 hover:bg-surface-warm hover:text-primary"
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              onPointerDown={stop_}
              onClick={onDelete}
              aria-label="Delete stop"
              className="rounded-md p-1 text-on-surface-variant/60 hover:bg-red-50 hover:text-red-600"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <span className="w-11 shrink-0 pt-0.5 font-mono text-xs text-on-surface-variant">
          {stop.startTime ?? "—"}
        </span>
        <span aria-hidden className="text-sm">
          {TYPE_ICONS[stop.type]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold leading-tight">
              {stop.title}
            </span>
            {stop.mustDo && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                must-do
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-on-surface-variant/70">
            {stop.durationMin != null && (
              <span>{Math.round(stop.durationMin / 6) / 10}h</span>
            )}
            {stop.costEstimate != null && <span>~${stop.costEstimate}</span>}
            <VerificationBadge verification={stop.verification} />
          </div>
        </div>
      </div>
    </div>
  );
}
