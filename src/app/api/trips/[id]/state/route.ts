import { NextRequest, NextResponse } from "next/server";
import { loadCanvasTrip } from "@/db/trips";

export const dynamic = "force-dynamic";

// GET — canvas-shaped trip state, used by the copilot to resync the board
// after applying changes without a full page reload.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const trip = await loadCanvasTrip(id).catch(() => null);
  if (!trip) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ trip });
}
