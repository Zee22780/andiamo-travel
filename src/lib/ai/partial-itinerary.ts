import { Itinerary, StopSchema } from "./schemas";

// Tolerant parse of the in-flight generation stream so the client can render
// days as they're planned. The accumulating text is valid JSON cut off
// mid-token; we auto-close open strings/brackets, parse, then keep only
// complete units (a trailing half-written stop/day/leg is trimmed — structured
// output emits fields in schema order, so completeness checks are cheap).
// Returns null until there's at least one renderable leg. Never throws.

function autoClose(text: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (stack.length === 0 && !inString) return text; // already complete
  let closed = text;
  if (escaped) closed = closed.slice(0, -1); // drop dangling backslash
  if (inString) closed += '"';
  // A dangling `"key":` or trailing comma breaks the parse — pad with null.
  closed = closed.replace(/([:,])\s*$/, "$1null");
  for (let i = stack.length - 1; i >= 0; i--) closed += stack[i];
  return closed;
}

const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function parseWithRecovery(text: string): unknown {
  try {
    return JSON.parse(autoClose(text) ?? "");
  } catch {
    // The cut landed inside a key or literal (`"mustDo": fa`). Every complete
    // stop/day ends in `}` — retruncate there and close from that point.
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace <= 0) return null;
    try {
      return JSON.parse(autoClose(text.slice(0, lastBrace + 1)) ?? "");
    } catch {
      return null;
    }
  }
}

export function parsePartialItinerary(text: string): Itinerary | null {
  const raw = parseWithRecovery(text);
  if (typeof raw !== "object" || raw === null) return null;
  const doc = raw as Record<string, unknown>;
  if (!Array.isArray(doc.legs)) return null;

  const legs: Itinerary["legs"] = [];
  for (const legRaw of doc.legs) {
    const leg = legRaw as Record<string, unknown> | null;
    // destination/startDate/endDate stream before days; an incomplete
    // trailing leg is dropped along with everything after it.
    if (
      !leg ||
      typeof leg.destination !== "string" ||
      !leg.destination ||
      !isDate(leg.startDate) ||
      !isDate(leg.endDate)
    )
      break;

    const days: Itinerary["legs"][number]["days"] = [];
    for (const dayRaw of Array.isArray(leg.days) ? leg.days : []) {
      const day = dayRaw as Record<string, unknown> | null;
      if (!day || !isDate(day.date)) break;
      const stops: Itinerary["legs"][number]["days"][number]["stops"] = [];
      for (const stopRaw of Array.isArray(day.stops) ? day.stops : []) {
        const parsed = StopSchema.safeParse(stopRaw);
        if (!parsed.success) break; // half-written trailing stop
        stops.push(parsed.data);
      }
      days.push({
        date: day.date,
        notes: typeof day.notes === "string" ? day.notes : null,
        stops,
      });
    }

    legs.push({
      destination: leg.destination,
      startDate: leg.startDate,
      endDate: leg.endDate,
      lodging: typeof leg.lodging === "string" ? leg.lodging : null,
      days,
    });
  }

  if (legs.length === 0) return null;
  return {
    tripName: typeof doc.tripName === "string" ? doc.tripName : "Your trip",
    legs,
  };
}

// Cheap growth signal so the route only emits a partial when new content
// actually completed.
export function countStops(itinerary: Itinerary): number {
  return itinerary.legs.reduce(
    (a, leg) => a + leg.days.reduce((b, day) => b + day.stops.length, 0),
    0,
  );
}
