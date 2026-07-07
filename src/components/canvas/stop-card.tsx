"use client";

import { PlacePhoto } from "@/components/place-photo";
import { cn } from "@/lib/utils";
import { CanvasStop } from "./types";

const TYPE_ICONS: Record<CanvasStop["type"], string> = {
  activity: "🏛️",
  meal: "🍽️",
  lodging: "🛏️",
  transit: "🚆",
};

// Verification happens automatically (on create + a sweep when the canvas
// opens), so a clean card IS the confirmed state. Badges mark exceptions and
// attribution only: a place that resolved but reports closed is the loud one,
// a traveler's own pick gets credit, and a place the sweep couldn't match gets
// a quiet hint — suppressed while the check is still running (`checking`) so
// fresh trips don't flash it before the sweep lands.
export function VerificationBadge({
  verification,
  source,
  isPlace,
  checking,
}: {
  verification: CanvasStop["verification"];
  source?: CanvasStop["source"];
  /** Activity/meal stops are real place lookups; transit/lodging notes aren't,
   * so they never get a confirmation hint. */
  isPlace: boolean;
  checking?: boolean;
}) {
  if (verification === "flagged") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
        Appears closed — needs replan
      </span>
    );
  }
  if (source === "user") {
    return (
      <span className="rounded-full bg-surface-variant/40 px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
        Your pick
      </span>
    );
  }
  if (verification === "unverified" && isPlace && !checking) {
    return (
      <span className="text-[10px] italic text-on-surface-variant/50">
        Couldn&apos;t confirm this place
      </span>
    );
  }
  return null;
}

export function StopCard({
  stop,
  index,
  dragging,
  onEdit,
  onDelete,
  onReplace,
  checking,
}: {
  stop: CanvasStop;
  /** 1-based position among *places* in the day — mirrors the numbered map
   * pin. Undefined for transit stops (journeys aren't numbered). */
  index?: number;
  dragging?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** One-tap fix for a flagged place: hands the copilot a scoped
   * swap-this-closed-place prompt. Only rendered when flagged. */
  onReplace?: () => void;
  /** True while the automatic verification sweep is in flight. */
  checking?: boolean;
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
        <div className="relative shrink-0">
          <PlacePhoto
            placeId={stop.placeId}
            width={120}
            gradient="bg-primary/10"
            className="h-10 w-10 rounded-lg"
            fallback={
              <span aria-hidden className="text-base">
                {TYPE_ICONS[stop.type]}
              </span>
            }
          />
          {index != null && (
            <span
              aria-hidden
              className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white ring-2 ring-white"
            >
              {index}
            </span>
          )}
        </div>
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
            <VerificationBadge
              verification={stop.verification}
              source={stop.source}
              isPlace={stop.type === "activity" || stop.type === "meal"}
              checking={checking}
            />
            {stop.verification === "flagged" && onReplace && (
              <button
                onPointerDown={stop_}
                onClick={onReplace}
                className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
              >
                Replace
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
