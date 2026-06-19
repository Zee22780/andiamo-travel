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

export function VerificationBadge({
  verification,
  source,
}: {
  verification: CanvasStop["verification"];
  source?: CanvasStop["source"];
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
  // A traveler's own pick isn't an AI guess — attribute it to them. The verify
  // pass can still confirm it later (verified/flagged take precedence above).
  if (source === "user") {
    return (
      <span className="rounded-full bg-surface-variant/40 px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
        Your pick
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
  index,
  dragging,
  onEdit,
  onDelete,
  onVerify,
  verifying,
}: {
  stop: CanvasStop;
  /** 1-based position in the day — mirrors the numbered pin on the map. */
  index?: number;
  dragging?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onVerify?: () => void;
  verifying?: boolean;
}) {
  // Buttons must swallow pointerdown so they don't start a drag.
  const stop_ = (e: React.PointerEvent) => e.stopPropagation();
  // A per-card "Verify" affordance for places that haven't been confirmed yet.
  const canVerify =
    onVerify &&
    stop.verification === "unverified" &&
    (stop.type === "activity" || stop.type === "meal");
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
              title={
                stop.type === "transit"
                  ? "Travel leg — not shown on the map"
                  : undefined
              }
              className={cn(
                "absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white",
                // Transit stops aren't pinned on the map — mute the badge so the
                // gap in map numbers reads as intentional, not missing.
                stop.type === "transit"
                  ? "bg-surface-variant text-on-surface-variant/70"
                  : "bg-primary text-white",
              )}
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
            />
            {canVerify && (
              <button
                onPointerDown={stop_}
                onClick={onVerify}
                disabled={verifying}
                className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60"
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
