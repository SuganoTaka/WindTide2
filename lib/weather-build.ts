import {
  buildDailySummaries,
  buildTideInfo,
  extendDailySummaries,
  findExtremes,
  msToLocal,
  type DailyMeta,
} from "./tide";
import type { DaySummary, HourPoint, TidePoint, WeatherResponse } from "./types";

export interface OpenMeteoRaw {
  utc_offset_seconds?: number;
  timezone?: string;
  current?: Record<string, number>;
  hourly?: Record<string, (string | number | null)[]>;
  daily?: Record<string, (string | number | null)[]>;
}

export const FORECAST_DAYS = 16;

export const FORECAST_PARAMS = {
  current: [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "precipitation",
    "weather_code",
    "pressure_msl",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
  ],
  hourly: [
    "temperature_2m",
    "precipitation",
    "precipitation_probability",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
  ],
  daily: [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "wind_direction_10m_dominant",
    "sunrise",
    "sunset",
  ],
  marine: ["wave_height", "sea_level_height_msl", "sea_surface_temperature"],
} as const;

export function openMeteoUrls(lat: number, lon: number) {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: "Asia/Tokyo",
    wind_speed_unit: "ms",
    forecast_days: String(FORECAST_DAYS),
  });
  return {
    forecast:
      `https://api.open-meteo.com/v1/forecast?${q.toString()}` +
      `&current=${FORECAST_PARAMS.current.join(",")}` +
      `&hourly=${FORECAST_PARAMS.hourly.join(",")}` +
      `&daily=${FORECAST_PARAMS.daily.join(",")}`,
    marine:
      `https://marine-api.open-meteo.com/v1/marine?${q.toString()}` +
      `&cell_selection=sea` +
      `&hourly=${FORECAST_PARAMS.marine.join(",")}`,
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Open-Meteo の生レスポンス（天気・海洋）から、画面が必要とする形に整える。
 * サーバー(Api Route)とブラウザ直叩きのフォールバックで同じ関数を使う。
 */
export function buildWeatherPayload(
  f: OpenMeteoRaw,
  m: OpenMeteoRaw | null,
  lat: number,
  lon: number
): WeatherResponse {
  const times = (f.hourly?.time as unknown as string[]) ?? [];
  const marineTimes = (m?.hourly?.time as unknown as string[]) ?? [];
  const marineIdx = new Map<string, number>();
  marineTimes.forEach((t, i) => marineIdx.set(t, i));

  const fh = f.hourly ?? {};
  const mh = m?.hourly ?? {};

  const hourly: HourPoint[] = times.map((t, i) => {
    const mi = marineIdx.get(t);
    return {
      t,
      temp: num(fh.temperature_2m?.[i]),
      precip: num(fh.precipitation?.[i]),
      precipProb: num(fh.precipitation_probability?.[i]),
      code: num(fh.weather_code?.[i]),
      wind: num(fh.wind_speed_10m?.[i]),
      windDir: num(fh.wind_direction_10m?.[i]),
      gust: num(fh.wind_gusts_10m?.[i]),
      wave: mi === undefined ? null : num(mh.wave_height?.[mi]),
      seaLevel: mi === undefined ? null : num(mh.sea_level_height_msl?.[mi]),
    };
  });

  const tidePoints: TidePoint[] = hourly
    .filter((h) => h.seaLevel != null)
    .map((h) => ({ t: h.t, h: h.seaLevel as number }));

  const offset = f.utc_offset_seconds ?? 32400;
  const nowLocal = msToLocal(Date.now() + offset * 1000);
  const startDate = nowLocal.slice(0, 10);

  const d = f.daily ?? {};
  const dailyTimes = (d.time as unknown as string[]) ?? [];
  const meta: DailyMeta[] = dailyTimes.map((date, i) => {
    const dayWave = hourly.filter((h) => h.t.slice(0, 10) === date && h.wave != null);
    return {
      date,
      code: num(d.weather_code?.[i]),
      tempMax: num(d.temperature_2m_max?.[i]),
      tempMin: num(d.temperature_2m_min?.[i]),
      precipProb: num(d.precipitation_probability_max?.[i]),
      sunrise: (d.sunrise?.[i] as string) ?? null,
      sunset: (d.sunset?.[i] as string) ?? null,
      waveMax: dayWave.length ? Math.max(...dayWave.map((h) => h.wave as number)) : null,
    };
  });

  const extremes = findExtremes(tidePoints);
  const measured = buildDailySummaries(hourly, extremes, meta, offset);
  const daily: DaySummary[] = extendDailySummaries(measured, extremes, startDate, 30, offset);

  const cur = f.current ?? {};
  const nowHour = hourly.find((h) => h.t.slice(0, 13) === nowLocal.slice(0, 13)) ?? hourly[0];
  const seaTempIdx = marineIdx.get(nowHour?.t ?? "");
  const tide = buildTideInfo(tidePoints, nowLocal, offset);

  return {
    location: { lat, lon },
    updatedAt: new Date().toISOString(),
    current: {
      temp: num(cur.temperature_2m),
      apparent: num(cur.apparent_temperature),
      humidity: num(cur.relative_humidity_2m),
      pressure: num(cur.pressure_msl),
      wind: num(cur.wind_speed_10m),
      windDir: num(cur.wind_direction_10m),
      gust: num(cur.wind_gusts_10m),
      code: num(cur.weather_code),
      precip: num(cur.precipitation),
      wave: nowHour?.wave ?? null,
      seaTemp: seaTempIdx === undefined ? null : num(mh.sea_surface_temperature?.[seaTempIdx]),
    },
    hourly,
    daily,
    tide,
    tideAvailable: tidePoints.length > 12,
    forecastDays: FORECAST_DAYS,
  };
}
