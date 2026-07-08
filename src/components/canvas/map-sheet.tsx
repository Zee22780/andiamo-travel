"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MapPane } from "./map-pane";
import { CanvasStop } from "./types";

// Mobile-only map affordance: a floating button that slides MapLibre up in a
// bottom sheet, so the map isn't a permanent strip stealing canvas height on a
// phone. Desktop keeps the always-on side panel (see TripWorkspace).
export function MapSheet({
  mapKey,
  stops,
  near,
  nearBase,
  dayLabel,
}: {
  mapKey: string | null;
  stops: CanvasStop[];
  near: string;
  nearBase: string;
  dayLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Mount MapPane only once the sheet has been opened, so MapLibre initialises
  // with real dimensions (the sheet has height the moment it opens).
  const [everOpened, setEverOpened] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Floating map button — sits above the copilot pill. */}
      <button
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
        aria-label="Show map"
        className="fixed bottom-28 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-2xl transition-transform active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-6 w-6"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex h-[72vh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex flex-col items-center pt-2.5">
          <div className="h-1.5 w-10 rounded-full bg-surface-variant" />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm font-bold">
            {dayLabel ? `Map · ${dayLabel}` : "Map"}
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close map"
            className="rounded-full px-2 py-1 text-sm font-medium text-on-surface-variant hover:text-primary"
          >
            Done
          </button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-2xl">
          {everOpened && mapKey ? (
            <MapPane
              mapKey={mapKey}
              stops={stops}
              near={near}
              nearBase={nearBase}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-warm p-6 text-center text-sm text-on-surface-variant/60">
              {mapKey ? "Loading map…" : "Add a MapTiler key to enable the map."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
