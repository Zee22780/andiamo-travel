import { NextRequest, NextResponse } from "next/server";
import { verifyTripPlaces } from "@/db/verify";

// POST — run the MapTiler verification pass over the trip's AI place stops:
// resolves coordinates and badges each Verified / Flagged. Returns counts.
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
