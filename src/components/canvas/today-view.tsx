"use client";

import { useEffect, useState } from "react";
import type { DayWeather } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { CanvasStop, CanvasTrip } from "./types";

// WMO weather code → icon + short label (forecast only).
function wmo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "Clear" };
  if (code <= 2) return { icon: "🌤️", label: "Partly cloudy" };
  if (code === 3) return { icon: "☁️", label: "Overcast" };
  if (code <= 48) return { icon: "🌫️", label: "Fog" };
  if (code <= 57) return { icon: "🌦️", label: "Drizzle" };
  if (code <= 67) return { icon: "🌧️", label: "Rain" };
  if (code <= 77) return { icon: "❄️", label: "Snow" };
  if (code <= 82) return { icon: "🌦️", label: "Showers" };
  if (code <= 86) return { icon: "🌨️", label: "Snow showers" };
  return { icon: "⛈️", label: "Thunderstorm" };
}

// Average coords of the day's located stops — the point we ask weather for.
function dayCoords(stops: CanvasStop[]): { lat: number; lng: number } | null {
  const pts = stops.filter((s) => s.lat != null && s.lng != null);
  if (pts.length === 0) return null;
  return {
    lat: pts.reduce((a, s) => a + (s.lat as number), 0) / pts.length,
    lng: pts.reduce((a, s) => a + (s.lng as number), 0) / pts.length,
  };
}

function useDayWeather(
  coords: { lat: number; lng: number } | null,
  date: string,
): DayWeather | null {
  const [weather, setWeather] = useState<DayWeather | null>(null);
  useEffect(() => {
    if (!coords) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/weather?lat=${coords.lat}&lng=${coords.lng}&date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { weather?: DayWeather | null } | null) => {
        if (!cancelled) setWeather(d?.weather ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coords?.lat, coords?.lng, date]);
  return weather;
}

function DayWeatherStrip({
  stops,
  date,
}: {
  stops: CanvasStop[];
  date: string;
}) {
  const weather = useDayWeather(dayCoords(stops), date);
  if (!weather) return null;
  return <WeatherStrip weather={weather} />;
}

function WeatherStrip({ weather }: { weather: DayWeather }) {
  const rainy = weather.precipChance >= 50;
  const cond = weather.kind === "forecast" ? wmo(weather.code) : null;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <span aria-hidden className="text-base">
          {cond ? cond.icon : "🗓️"}
        </span>
        <span className="font-semibold text-on-surface">
          {weather.tempMaxC}° / {weather.tempMinC}°
        </span>
        {cond && <span>{cond.label}</span>}
        <span className="text-on-surface-variant/70">
          {weather.kind === "normal"
            ? `· typical · rain ~${weather.precipChance}% of years`
            : `· ${weather.precipChance}% rain`}
        </span>
      </div>
      {rainy && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
          <span aria-hidden>🌧️</span>
          {weather.kind === "normal"
            ? "Rain is common on this date — pack a layer."
            : "Rain likely — keep an indoor option handy."}
        </div>
      )}
    </div>
  );
}

const TYPE_ICONS: Record<CanvasStop["type"], string> = {
  activity: "🏛️",
  meal: "🍽️",
  lodging: "🛏️",
  transit: "🚆",
};

// Local calendar day as YYYY-MM-DD — matches how stop/day dates are stored
// (plain dates), avoiding UTC-offset drift from toISOString.
function localToday(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

function parseHHMM(t: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

function longDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

type FlatDay = {
  legDestination: string;
  date: string;
  dayNumber: number;
  notes: string | null;
  stops: CanvasStop[];
};

function flattenDays(trip: CanvasTrip): FlatDay[] {
  const out: FlatDay[] = [];
  let n = 0;
  for (const leg of trip.legs) {
    for (const day of leg.days) {
      n += 1;
      out.push({
        legDestination: leg.destination,
        date: day.date,
        dayNumber: n,
        notes: day.notes,
        stops: day.stops,
      });
    }
  }
  return out;
}

export function TodayView({
  trip,
  onReplan,
  replanning,
}: {
  trip: CanvasTrip;
  onReplan?: (message: string) => void;
  replanning?: boolean;
}) {
  // Re-tick each minute so the now-indicator and past/current state stay live.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const days = flattenDays(trip);
  if (days.length === 0) {
    return (
      <Centered>
        <p className="text-on-surface-variant">This trip has no days yet.</p>
      </Centered>
    );
  }

  const today = localToday(now);
  const first = days[0].date;
  const last = days[days.length - 1].date;

  // Before the trip — count down and preview day one.
  if (today < first) {
    const out = daysBetween(today, first);
    return (
      <Centered>
        <Phase label="Upcoming" />
        <h2 className="mt-3 font-headline text-3xl font-bold">
          {out === 1 ? "Tomorrow's the day" : `${out} days to go`}
        </h2>
        <p className="mt-1 text-on-surface-variant">
          {trip.name} begins {longDate(first)} in {days[0].legDestination}.
        </p>
        <DayPreview day={days[0]} heading="First day" />
      </Centered>
    );
  }

  // After the trip — gentle recap entry point.
  if (today > last) {
    return (
      <Centered>
        <Phase label="Past" />
        <h2 className="mt-3 font-headline text-3xl font-bold">
          This trip has wrapped
        </h2>
        <p className="mt-1 text-on-surface-variant">
          {trip.name} ran through {longDate(last)}. Switch to Plan to revisit the
          full itinerary.
        </p>
      </Centered>
    );
  }

  // Active — find today's day, or the next upcoming day on a gap between legs.
  const activeDay =
    days.find((d) => d.date === today) ?? days.find((d) => d.date > today);
  if (!activeDay) {
    return (
      <Centered>
        <p className="text-on-surface-variant">Nothing scheduled right now.</p>
      </Centered>
    );
  }

  const isToday = activeDay.date === today;
  const nMin = nowMinutes(now);
  const timed = [...activeDay.stops].sort((a, b) => {
    const ta = parseHHMM(a.startTime);
    const tb = parseHHMM(b.startTime);
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  const statusOf = (s: CanvasStop): "past" | "current" | "upcoming" => {
    if (!isToday) return "upcoming";
    const start = parseHHMM(s.startTime);
    if (start == null) return "upcoming";
    const end = start + (s.durationMin ?? 60);
    if (nMin >= end) return "past";
    if (nMin >= start) return "current";
    return "upcoming";
  };

  // Index where the "now" line sits: before the first not-yet-past stop.
  const nowLineIdx = isToday
    ? timed.findIndex((s) => statusOf(s) !== "past")
    : -1;

  const nowLabel = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto px-5 py-6">
      <Phase label={isToday ? "Today" : "Up next"} />
      <h2 className="mt-2 font-headline text-2xl font-bold leading-tight">
        Day {activeDay.dayNumber} · {activeDay.legDestination}
      </h2>
      <p className="text-sm text-on-surface-variant">{longDate(activeDay.date)}</p>
      {activeDay.notes && (
        <p className="mt-1 text-sm italic text-on-surface-variant/70">
          {activeDay.notes}
        </p>
      )}
      <DayWeatherStrip stops={activeDay.stops} date={activeDay.date} />

      {isToday && onReplan && timed.some((s) => statusOf(s) !== "past") && (
        <button
          onClick={() => {
            const done = timed.filter((s) => statusOf(s) === "past");
            const remaining = timed.filter((s) => statusOf(s) !== "past");
            const mustDos = remaining.filter((s) => s.mustDo).map((s) => s.title);
            const msg =
              `It's now ${nowLabel} on ${longDate(activeDay.date)} — Day ${activeDay.dayNumber} in ${activeDay.legDestination}. ` +
              `Replan the rest of today from now. ` +
              `Already done, leave unchanged: ${done.map((s) => s.title).join("; ") || "nothing yet"}. ` +
              `Still to come: ${remaining.map((s) => s.title).join("; ")}. ` +
              `Re-time the remaining stops so they realistically fit from ${nowLabel} onward, shorten or drop whatever no longer fits, and keep a sensible order. ` +
              `Never drop a must-do${mustDos.length ? ` (${mustDos.join("; ")})` : ""}. ` +
              `Apply the changes directly with update_stops — don't just suggest them.`;
            onReplan(msg);
          }}
          disabled={replanning}
          className="mt-4 w-full rounded-full bg-accent px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
        >
          {replanning ? "Replanning…" : "↻ Replan rest of day"}
        </button>
      )}

      <ol className="mt-5 space-y-2.5">
        {timed.map((s, i) => (
          <li key={s.id}>
            {i === nowLineIdx && <NowLine label={nowLabel} />}
            <StopRow stop={s} status={statusOf(s)} />
          </li>
        ))}
        {/* All stops are in the past — drop the now line at the end. */}
        {isToday && nowLineIdx === -1 && timed.length > 0 && (
          <NowLine label={nowLabel} trailing />
        )}
        {timed.length === 0 && (
          <li className="rounded-xl border border-dashed border-surface-variant p-5 text-center text-sm text-on-surface-variant/60">
            No stops planned for this day.
          </li>
        )}
      </ol>
    </div>
  );
}

function StopRow({
  stop,
  status,
}: {
  stop: CanvasStop;
  status: "past" | "current" | "upcoming";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 transition-colors",
        status === "current" &&
          "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20",
        status === "upcoming" && "border-surface-variant bg-white",
        status === "past" && "border-transparent bg-surface-warm opacity-55",
      )}
    >
      <span
        className={cn(
          "w-12 shrink-0 pt-0.5 font-mono text-xs",
          status === "current" ? "font-bold text-primary" : "text-on-surface-variant",
        )}
      >
        {stop.startTime ?? "—"}
      </span>
      <span aria-hidden className="text-base leading-none">
        {TYPE_ICONS[stop.type]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-sm font-semibold leading-tight",
              status === "past" && "line-through decoration-on-surface-variant/30",
            )}
          >
            {stop.title}
          </span>
          {stop.mustDo && status !== "past" && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
              must-do
            </span>
          )}
        </div>
        {stop.durationMin != null && (
          <span className="text-[11px] text-on-surface-variant/70">
            {Math.round(stop.durationMin / 6) / 10}h
          </span>
        )}
      </div>
      {status === "current" && (
        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
          now
        </span>
      )}
    </div>
  );
}

function NowLine({ label, trailing }: { label: string; trailing?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", trailing ? "mt-2.5" : "mb-2.5")}>
      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
        Now · {label}
      </span>
      <div className="h-px flex-1 bg-accent/40" />
    </div>
  );
}

function DayPreview({ day, heading }: { day: FlatDay; heading: string }) {
  return (
    <div className="mt-6 w-full rounded-2xl border border-surface-variant bg-white p-4 text-left">
      <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50">
        {heading}
      </p>
      <DayWeatherStrip stops={day.stops} date={day.date} />
      <ol className="mt-3 space-y-1.5">
        {day.stops.slice(0, 5).map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span className="w-12 shrink-0 font-mono text-xs text-on-surface-variant">
              {s.startTime ?? "—"}
            </span>
            <span aria-hidden>{TYPE_ICONS[s.type]}</span>
            <span className="truncate">{s.title}</span>
          </li>
        ))}
        {day.stops.length === 0 && (
          <li className="text-sm text-on-surface-variant/60">
            No stops planned yet.
          </li>
        )}
      </ol>
    </div>
  );
}

function Phase({ label }: { label: string }) {
  return (
    <span className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
      {label}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
