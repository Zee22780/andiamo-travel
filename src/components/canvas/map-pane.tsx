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

// Stop titles often lead with an activity/meal descriptor before the real
// place ("Lunch at All'Antico Vinaio", "Sunset at Piazzale Michelangelo",
// "Check in near Santa Croce"). The geocoder chokes on that and returns a
// far-off fallback the anchor filter drops, so the pin disappears. Cutting the
// short leading phrase up to its location connector ("at/on/in/near/…") leaves
// the real name, which resolves cleanly. The 40-char cap keeps the connector
// near the start so we don't slice a name mid-string. Applied only on retry and
// gated by the anchor check, so an over-strip just yields no pin (as before),
// never a wrong one. (Verified stops skip geocoding entirely.)
const PLACE_PREFIX =
  /^.{0,40}?\b(?:at|on|in|near|by|overlooking|along|around)\b\s+/i;

function cleanPlaceQuery(title: string): string {
  return title
    .replace(/\([^)]*\)/g, "")
    .replace(PLACE_PREFIX, "")
    .trim();
}

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
  nearBase,
}: {
  mapKey: string;
  stops: CanvasStop[];
  near: string;
  // The bare leg destination without the region suffix (e.g. "Positano" for a
  // `near` of "Positano, Amalfi Coast"). Used as a fallback anchor when the
  // region suffix mis-geocodes.
  nearBase: string;
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
      // Ground-truth reference from stops that already carry real coordinates
      // (verified via Places). Its centroid tells us which region the trip is
      // actually in, so we can arbitrate between anchor candidates below.
      const storedCoords = stops
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => [s.lng!, s.lat!] as [number, number]);
      const storedCentroid: [number, number] | null = storedCoords.length
        ? [
            storedCoords.reduce((a, c) => a + c[0], 0) / storedCoords.length,
            storedCoords.reduce((a, c) => a + c[1], 0) / storedCoords.length,
          ]
        : null;

      let anchor: [number, number] | null = null;
      try {
        // Geocode the region-suffixed anchor and, when it differs, the bare
        // destination too. The suffix normally disambiguates an ambiguous city
        // ("Florence" -> "Florence, Italy"), but when the region itself matches
        // an unrelated place ("Amalfi Coast" -> a road in Texas) it drags the
        // anchor far from the real destination.
        const items = [{ id: "__anchor__", query: near }];
        if (nearBase && nearBase !== near)
          items.push({ id: "__anchor_base__", query: nearBase });
        const aRes = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (aRes.ok) {
          const { coords } = (await aRes.json()) as {
            coords: Record<string, [number, number]>;
          };
          const suffixed = coords["__anchor__"] ?? null;
          const base = coords["__anchor_base__"] ?? null;
          // With ground truth, pick whichever candidate sits nearer the real
          // stops — this rejects the Texas mis-geocode yet still prefers
          // "Florence, Italy" over "Florence, Alabama". Without it, keep the
          // suffixed anchor (today's behavior); fall back to the bare one.
          const dist = (a: [number, number], b: [number, number]) =>
            Math.hypot(a[0] - b[0], a[1] - b[1]);
          anchor =
            suffixed && base && storedCentroid
              ? dist(suffixed, storedCentroid) <= dist(base, storedCentroid)
                ? suffixed
                : base
              : (suffixed ?? base);
        }
      } catch {
        // non-fatal; fit falls back to stop points
      }
      const nearAnchor = (c: [number, number]) =>
        !anchor ||
        (Math.abs(c[0] - anchor[0]) < 1.5 && Math.abs(c[1] - anchor[1]) < 1.5);

      // Verified stops carry stored coordinates; only geocode the rest.
      const placeStops = stops.filter(
        (s) => s.type !== "transit" && (s.lat == null || s.lng == null),
      );
      const coords = await geocodeStops(placeStops, near);
      // A title that resolved nowhere, or to a point the anchor rejects, is
      // usually descriptive ("Lunch at …"); retry it with the prefix stripped
      // and keep the cleaned result only if it lands near the destination.
      const retry = placeStops
        .map((s) => ({ s, q: cleanPlaceQuery(s.title) }))
        .filter(({ s, q }) => {
          const c = coords.get(s.id);
          return (!c || !nearAnchor(c)) && q !== "" && q !== s.title;
        });
      if (retry.length) {
        const fixed = await geocodeByQuery(
          retry.map(({ s, q }) => ({ id: s.id, query: q })),
          near,
        );
        for (const { s } of retry) {
          const c = fixed.get(s.id);
          if (c && nearAnchor(c)) coords.set(s.id, c);
        }
      }
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

      markers.current.forEach((mk) => mk.remove());
      markers.current = [];

      const nums = placeNumbers(stops);
      const points: [number, number][] = [];
      // Points that came from stored (verified) coordinates are ground truth —
      // they drive framing directly, never filtered or padded by the anchor.
      let storedPoints = 0;
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
        // Stored (verified) coordinates come from Google Places and are
        // authoritative; the anchor sanity check only guards *geocoded* titles,
        // which can resolve far away. Filtering stored pins by the anchor is
        // actively harmful when the anchor itself mis-geocodes (e.g. a region
        // like "Amalfi Coast" resolving to a road in Texas) — it would drop
        // every correct pin and strand the map on the bad anchor.
        const stored = stop.lat != null && stop.lng != null;
        const c = coordFor(stop);
        if (!c || (!stored && !nearAnchor(c))) return;
        points.push(c);
        if (stored) storedPoints++;
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

      if (points.length === 1 && anchor && storedPoints === 0) {
        // A single *geocoded* stop is too thin to trust fully (it may be a
        // nearby town, not the city). Frame the destination too so we never
        // strand the user on a mis-resolved pin. Stored (verified) coordinates
        // are exact, so they skip this and center directly (below).
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
