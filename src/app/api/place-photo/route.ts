import { NextRequest, NextResponse } from "next/server";
import { resolvePhotoUri } from "@/lib/place-photos";

export const dynamic = "force-dynamic";

// Key-safe Place Photos proxy. Resolves a photo URI for ?placeId= or ?q= (with
// optional ?w= width) and redirects to the googleusercontent image, which the
// browser then caches. 404 when there's no photo, so the client falls back to
// its gradient.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const placeId = sp.get("placeId") || undefined;
  const query = sp.get("q") || undefined;
  const w = Math.min(Math.max(Number(sp.get("w")) || 400, 80), 1600);

  if (!placeId && !query) {
    return new NextResponse(null, { status: 400 });
  }

  const uri = await resolvePhotoUri({ placeId, query, maxWidth: w });
  if (!uri) return new NextResponse(null, { status: 404 });

  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: uri,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
