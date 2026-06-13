"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { CanvasStop } from "./types";

// Geocode cache shared across focus changes within a session.
const coordCache = new Map<string, [number, number]>();

async function geocodeStops(
  stops: CanvasStop[],
  near: string,
): Promise<Map<string, [number, number]>> {
  const out = new Map<string, [number, number]>();
  const missing: { id: string; query: string }[] = [];
  for (const s of stops) {
    const key = `${s.title} @ ${near}`;
    if (coordCache.has(key)) out.set(s.id, coordCache.get(key)!);
    else missing.push({ id: s.id, query: s.title });
  }
  if (missing.length) {
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ near, items: missing }),
      });
      if (res.ok) {
        const { coords } = (await res.json()) as {
          coords: Record<string, [number, number]>;
        };
        for (const m of missing) {
          const c = coords[m.id];
          if (c) {
            coordCache.set(`${m.query} @ ${near}`, c);
            out.set(m.id, c);
          }
        }
      }
    } catch {
      // map degrades to empty; non-fatal
    }
  }
  return out;
}

export function MapPane({
  mapKey,
  stops,
  near,
}: {
  mapKey: string;
  stops: CanvasStop[];
  near: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  // Init map once
  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = new maplibregl.Map({
      container: container.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapKey}`,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapKey]);

  // Re-plot when the focused day's stops change
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    let cancelled = false;

    (async () => {
      // Anchor on the destination so we can reject mis-geocoded stops
      // (descriptive titles like "Walk across the bridge to Gaia" sometimes
      // resolve far away). P2's Places verification removes the need for this.
      const anchorMap = await geocodeStops(
        [{ id: "__anchor__", title: near } as CanvasStop],
        near,
      );
      const anchor = anchorMap.get("__anchor__") ?? null;
      const coords = await geocodeStops(stops, near);
      if (cancelled || !map.current) return;

      const nearAnchor = (c: [number, number]) =>
        !anchor ||
        (Math.abs(c[0] - anchor[0]) < 1.5 && Math.abs(c[1] - anchor[1]) < 1.5);

      markers.current.forEach((mk) => mk.remove());
      markers.current = [];

      const points: [number, number][] = [];
      stops.forEach((stop, i) => {
        const c = coords.get(stop.id);
        if (!c || !nearAnchor(c)) return;
        points.push(c);
        const el = document.createElement("div");
        el.className =
          "flex h-7 w-7 items-center justify-center rounded-full bg-[#0E7C6B] text-xs font-bold text-white shadow-md ring-2 ring-white";
        el.textContent = String(i + 1);
        markers.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat(c)
            .setPopup(new maplibregl.Popup({ offset: 16 }).setText(stop.title))
            .addTo(m),
        );
      });

      const routeId = "route-line";
      if (m.getLayer(routeId)) m.removeLayer(routeId);
      if (m.getSource(routeId)) m.removeSource(routeId);

      const applyRoute = () => {
        if (points.length >= 2) {
          m.addSource(routeId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: points },
            },
          });
          m.addLayer({
            id: routeId,
            type: "line",
            source: routeId,
            paint: {
              "line-color": "#0E7C6B",
              "line-width": 3,
              "line-dasharray": [2, 1.5],
            },
          });
        }
      };
      if (m.isStyleLoaded()) applyRoute();
      else m.once("load", applyRoute);

      if (points.length === 1) {
        m.flyTo({ center: points[0], zoom: 14 });
      } else if (points.length > 1) {
        const b = new maplibregl.LngLatBounds(points[0], points[0]);
        points.forEach((p) => b.extend(p));
        m.fitBounds(b, { padding: 64, maxZoom: 15, duration: 600 });
      } else if (anchor) {
        m.flyTo({ center: anchor, zoom: 12 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stops, near]);

  return <div ref={container} className="h-full w-full" />;
}
