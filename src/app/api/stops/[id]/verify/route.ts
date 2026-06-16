import { NextRequest, NextResponse } from "next/server";
import { verifyStopById } from "@/db/verify";

export const dynamic = "force-dynamic";

// POST — verify a single stop against Google Places (the per-card "Verify"
// action): resolves place_id + coordinates and badges it Verified / Flagged /
// AI guess from live business_status. Returns the resulting status.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const result = await verifyStopById(id);
    if (!result) {
      return NextResponse.json({ error: "could not verify" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "verify failed" }, { status: 500 });
  }
}
