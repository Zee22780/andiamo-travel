"use client";

import { useEffect, useRef, useState } from "react";
import type { TravelLeg } from "@/lib/routes";
import { CanvasStop } from "./types";

export type TravelLegMap = Record<string, TravelLeg | null>; // key: `${fromId}->${toId}`

const pairKey = (fromId: string, toId: string) => `${fromId}->${toId}`;

// Build the consecutive located-stop pairs across all days, fetch real Routes
// durations once per distinct pair-set, and expose them keyed by stop-id pair
// so each day column can drop a chip between two cards. Recomputes when the
// canvas order changes (drag, add, verify) — the server caches by coords so
// repeated fetches of the same geometry are cheap.
export function useTravelTimes(
  tripId: string,
  dayStops: Record<string, CanvasStop[]>,
): TravelLegMap {
  const [legs, setLegs] = useState<TravelLegMap>({});
  const lastSig = useRef<string>("");

  useEffect(() => {
    const pairs: { key: string; from: { lat: number; lng: number }; to: { lat: number; lng: number } }[] = [];
    for (const stops of Object.values(dayStops)) {
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];
        if (a.lat == null || a.lng == null || b.lat == null || b.lng == null)
          continue;
        pairs.push({
          key: pairKey(a.id, b.id),
          from: { lat: a.lat, lng: a.lng },
          to: { lat: b.lat, lng: b.lng },
        });
      }
    }
    // Signature includes coords so a reorder that changes adjacency refetches,
    // but a no-op re-render doesn't.
    const sig = pairs
      .map((p) => `${p.key}@${p.from.lat},${p.from.lng}|${p.to.lat},${p.to.lng}`)
      .join(";");
    if (sig === lastSig.current) return;
    lastSig.current = sig;

    if (pairs.length === 0) {
      setLegs({});
      return;
    }
    let cancelled = false;
    fetch(`/api/trips/${tripId}/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { legs?: TravelLegMap } | null) => {
        if (!cancelled && data?.legs) setLegs(data.legs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tripId, dayStops]);

  return legs;
}
