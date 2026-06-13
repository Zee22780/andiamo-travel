import { NextRequest, NextResponse } from "next/server";
import { verifyTripPlaces } from "@/db/verify";

// POST — run the Google Places verification pass over the trip's AI place
// stops: resolves place_id + coordinates and badges each Verified / Flagged /
// AI guess from live business_status. Returns counts.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const result = await verifyTripPlaces(id);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "verify failed" }, { status: 500 });
  }
}
