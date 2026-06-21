"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { placeNumbers } from "./numbering";
import { CanvasStop } from "./types";

// Geocode cache shared across focus changes within a session.
const coordCache = new Map<string, [number, number]>();

async function geocodeByQuery(
  items: { id: string; query: string }[],
  near: string,
): Promise<Map<string, [number, number]>> {
  const out = new Map<string, [number, number]>();
  const missing: { id: string; query: string }[] = [];
  for (const it of items) {
    const key = `${it.query} @ ${near}`;
    if (coordCache.has(key)) out.set(it.id, coordCache.get(key)!);
    else missing.push(it);
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

const geocodeStops = (stops: CanvasStop[], near: string) =>
  geocodeByQuery(
    stops.map((s) => ({ id: s.id, query: s.title })),
    near,
  );

const TRANSIT_MODE = /^(shinkansen|train|bus|flight|drive|subway|ferry|taxi|walk)\s+/i;

// A transit stop is a journey, not a place. Most sit between two pinned stops —
// the line between those pins already shows the trip, so they need nothing. But
// a *boundary* transfer enters or leaves the mapped area (an airport arrival,
// a departure): one endpoint is otherwise invisible. We surface that endpoint
// as a start/end marker so the journey has somewhere to begin or end.
function boundaryEndpoint(
  stops: CanvasStop[],
  i: number,
): { kind: "leading" | "trailing"; query: string } | null {
  const stop = stops[i];
  if (stop.type !== "transit") return null;
  const before = stops.slice(0, i).some((s) => s.type !== "transit");
  const after = stops.slice(i + 1).some((s) => s.type !== "transit");
  if (before && after) return null; // interstitial — line already shows it
  // Leading transfers introduce their origin (where you came from); trailing
  // ones introduce their destination (where you're headed).
  const kind = before ? "trailing" : "leading";
  const parts = stop.title.split(/\s+to\s+/i);
  const seg = (kind === "leading" ? parts[0] : parts[parts.length - 1])
    .replace(/\([^)]*\)/g, "")
    .replace(TRANSIT_MODE, "")
    .trim();
  return seg ? { kind, query: seg } : null;
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
      // Geocode the destination itself with no extra context (it already
      // includes the region, e.g. "Florence, Italy").
      let anchor: [number, number] | null = null;
      try {
        const aRes = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ id: "__anchor__", query: near }] }),
        });
        if (aRes.ok) {
          const { coords } = (await aRes.json()) as {
            coords: Record<string, [number, number]>;
          };
          anchor = coords["__anchor__"] ?? null;
        }
      } catch {
        // non-fatal; fit falls back to stop points
      }
      // Verified stops carry stored coordinates; only geocode the rest.
      const coords = await geocodeStops(
        stops.filter(
          (s) => s.type !== "transit" && (s.lat == null || s.lng == null),
        ),
        near,
      );
      // Boundary transfers (airport arrival/departure) introduce one endpoint
      // the map wouldn't otherwise show; geocode just that endpoint.
      const boundaryByStop = new Map<
        string,
        { kind: "leading" | "trailing"; query: string }
      >();
      stops.forEach((s, i) => {
        const b = boundaryEndpoint(stops, i);
        if (b) boundaryByStop.set(s.id, b);
      });
      const boundaryCoords = boundaryByStop.size
        ? await geocodeByQuery(
            [...boundaryByStop].map(([id, b]) => ({ id, query: b.query })),
            near,
          )
        : new Map<string, [number, number]>();
      if (cancelled || !map.current) return;

      const coordFor = (stop: CanvasStop): [number, number] | undefined =>
        stop.lat != null && stop.lng != null
          ? [stop.lng, stop.lat]
          : coords.get(stop.id);

      const nearAnchor = (c: [number, number]) =>
        !anchor ||
        (Math.abs(c[0] - anchor[0]) < 1.5 && Math.abs(c[1] - anchor[1]) < 1.5);

      markers.current.forEach((mk) => mk.remove());
      markers.current = [];

      const nums = placeNumbers(stops);
      const points: [number, number][] = [];
      stops.forEach((stop) => {
        // Transit is a journey, not a place. Interstitial hops show as the line
        // between their pinned neighbors; only boundary transfers get a marker.
        if (stop.type === "transit") {
          if (!boundaryByStop.has(stop.id)) return;
          const c = boundaryCoords.get(stop.id);
          if (!c || !nearAnchor(c)) return;
          points.push(c); // in stop order, so the line runs through the airport
          const el = document.createElement("div");
          el.className =
            "flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0E7C6B] bg-white text-sm shadow-md ring-1 ring-white";
          el.textContent = /airport/i.test(stop.title) ? "✈" : "🚆";
          markers.current.push(
            new maplibregl.Marker({ element: el })
              .setLngLat(c)
              .setPopup(
                new maplibregl.Popup({ offset: 16 }).setText(stop.title),
              )
              .addTo(m),
          );
          return;
        }
        const c = coordFor(stop);
        if (!c || !nearAnchor(c)) return;
        points.push(c);
        // One pin style for every place; the card's verification badge already
        // conveys confidence. The number mirrors the card badge (places only).
        const el = document.createElement("div");
        el.className =
          "flex h-7 w-7 items-center justify-center rounded-full bg-[#0E7C6B] text-xs font-bold text-white shadow-md ring-2 ring-white";
        el.textContent = String(nums.get(stop.id));
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

      if (points.length === 1 && anchor) {
        // One stop is too thin to trust the geocode fully (it may be a nearby
        // town, not the city). Frame the destination too so we never strand
        // the user on a mis-resolved pin.
        const b = new maplibregl.LngLatBounds(anchor, anchor);
        b.extend(points[0]);
        m.fitBounds(b, { padding: 96, maxZoom: 13, duration: 600 });
      } else if (points.length === 1) {
        m.flyTo({ center: points[0], zoom: 13 });
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
