import { NextRequest, NextResponse } from "next/server";
import { getDayWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

// GET ?lat=..&lng=..&date=YYYY-MM-DD → per-day weather (forecast or climate
// normal), for the Today view's weather strip + rain alert. Open-Meteo, no key.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const date = searchParams.get("date") ?? "";
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const weather = await getDayWeather(lat, lng, date);
  return NextResponse.json({ weather });
}
