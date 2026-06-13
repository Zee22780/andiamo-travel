import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { travelTimes } from "@/lib/routes";

export const dynamic = "force-dynamic";

// POST — compute travel-time legs between consecutive stops. The canvas sends
// the ordered located-stop pairs it wants chips for (keyed by stop-id pair);
// we return real Routes API durations + the chosen mode. Trip-scoped by route
// for convention; the body carries the coords.
const bodySchema = z.object({
  pairs: z
    .array(
      z.object({
        key: z.string(),
        from: z.object({ lat: z.number(), lng: z.number() }),
        to: z.object({ lat: z.number(), lng: z.number() }),
      }),
    )
    .max(100),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (parsed.data.pairs.length === 0) return NextResponse.json({ legs: {} });
  try {
    const legs = await travelTimes(parsed.data.pairs);
    return NextResponse.json({ legs });
  } catch {
    return NextResponse.json({ error: "routes failed" }, { status: 500 });
  }
}
