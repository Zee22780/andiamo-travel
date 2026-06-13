"use client";

import { useEffect, useState } from "react";

// Tracks whether the viewport is at the `lg` breakpoint (≥1024px), matching
// Tailwind's `lg:`. Returns `null` until mounted so server render and the first
// client render agree (no hydration mismatch); callers should treat `null` as
// "not yet known" and default to the desktop layout, which is what the markup
// SSRs as.
export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
