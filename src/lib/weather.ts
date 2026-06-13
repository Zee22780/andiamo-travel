// Open-Meteo weather (free, no key). Near-term dates use the forecast API;
// far-future dates (beyond the forecast horizon) fall back to a climate normal
// computed from the historical archive for the same calendar day across recent
// years. Results are cached in-process to avoid hammering the API on re-renders.

export type DayWeather = {
  tempMaxC: number;
  tempMinC: number;
  // Probability of meaningful precipitation, 0–100. For forecasts this is the
  // API's precipitation_probability_max; for normals it's the share of recent
  // years that saw rain/snow on this day.
  precipChance: number;
  code: number; // WMO weather code (forecast only; null-ish for normals)
  kind: "forecast" | "normal";
};

const FORECAST_HORIZON_DAYS = 15; // Open-Meteo forecast reaches ~16 days
const NORMAL_YEARS = 5; // years of archive to average for a climate normal
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { value: DayWeather | null; at: number }>();

function daysFromToday(date: string): number {
  const a = new Date(`${date}T00:00:00`).getTime();
  const now = new Date();
  const b = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return Math.round((a - b) / 86_400_000);
}

async function forecastDay(
  lat: number,
  lng: number,
  date: string,
): Promise<DayWeather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=auto&start_date=${date}&end_date=${date}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const d = (await res.json()) as {
    daily?: {
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: (number | null)[];
      weather_code?: number[];
    };
  };
  const day = d.daily;
  if (!day?.temperature_2m_max?.length) return null;
  return {
    tempMaxC: Math.round(day.temperature_2m_max[0]),
    tempMinC: Math.round(day.temperature_2m_min?.[0] ?? day.temperature_2m_max[0]),
    precipChance: Math.round(day.precipitation_probability_max?.[0] ?? 0),
    code: day.weather_code?.[0] ?? 0,
    kind: "forecast",
  };
}

// Climate normal: same MM-DD across the last NORMAL_YEARS, averaged. Precip
// chance = share of those years with >1mm of precipitation that day.
async function normalDay(
  lat: number,
  lng: number,
  date: string,
): Promise<DayWeather | null> {
  const mmdd = date.slice(5); // MM-DD
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: NORMAL_YEARS }, (_, i) => thisYear - 1 - i);
  const results = await Promise.all(
    years.map(async (y) => {
      const d = `${y}-${mmdd}`;
      const url =
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&timezone=auto&start_date=${d}&end_date=${d}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const j = (await res.json()) as {
          daily?: {
            temperature_2m_max?: number[];
            temperature_2m_min?: number[];
            precipitation_sum?: number[];
          };
        };
        const day = j.daily;
        if (day?.temperature_2m_max?.[0] == null) return null;
        return {
          max: day.temperature_2m_max[0],
          min: day.temperature_2m_min?.[0] ?? day.temperature_2m_max[0],
          precip: day.precipitation_sum?.[0] ?? 0,
        };
      } catch {
        return null;
      }
    }),
  );
  const ok = results.filter((r): r is NonNullable<typeof r> => r != null);
  if (ok.length === 0) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const wetDays = ok.filter((r) => r.precip > 1).length;
  return {
    tempMaxC: Math.round(avg(ok.map((r) => r.max))),
    tempMinC: Math.round(avg(ok.map((r) => r.min))),
    precipChance: Math.round((wetDays / ok.length) * 100),
    code: 0,
    kind: "normal",
  };
}

export async function getDayWeather(
  lat: number,
  lng: number,
  date: string,
): Promise<DayWeather | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}@${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const out = daysFromToday(date);
  let value: DayWeather | null = null;
  try {
    value =
      out >= 0 && out <= FORECAST_HORIZON_DAYS
        ? await forecastDay(lat, lng, date)
        : await normalDay(lat, lng, date);
  } catch {
    value = null;
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}
