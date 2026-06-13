"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// A gradient-backed image tile that fetches a Google Place Photo (by place_id
// or city query) through the /api/place-photo proxy. The gradient always
// renders as the background; the photo fades in over it on load and is dropped
// on error or when no place_id/query is given. `fallback` paints behind the
// photo (e.g. a category icon for unphotographed stops); `children` paint on
// top (status pills, scrims) and position themselves with absolute classes.
export function PlacePhoto({
  placeId,
  query,
  width = 400,
  gradient,
  className,
  imgClassName,
  fallback,
  children,
}: {
  placeId?: string | null;
  query?: string | null;
  width?: number;
  gradient: string;
  className?: string;
  imgClassName?: string;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const params = placeId
    ? `placeId=${encodeURIComponent(placeId)}`
    : query
      ? `q=${encodeURIComponent(query)}`
      : null;
  const showImg = params !== null && !failed;

  return (
    <div className={cn("relative overflow-hidden", gradient, className)}>
      {fallback && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback}
        </div>
      )}
      {showImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // A browser-cached image can finish before React attaches onLoad, so
          // its event never fires — check `complete` on mount to avoid getting
          // stuck at opacity-0.
          ref={(node) => {
            if (!node || !node.complete) return;
            if (node.naturalWidth > 0) setLoaded(true);
            else setFailed(true);
          }}
          src={`/api/place-photo?${params}&w=${width}`}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      )}
      {children}
    </div>
  );
}
