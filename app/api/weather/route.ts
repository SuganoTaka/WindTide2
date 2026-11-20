import { NextResponse } from "next/server";
import { TTL, cacheGet, cacheSet, fetchJson, parseLatLon } from "@/lib/api-cache";
import { buildWeatherPayload, openMeteoUrls, type OpenMeteoRaw } from "@/lib/weather-build";
import type { WeatherResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const loc = parseLatLon(url);
  if (!loc) {
    return NextResponse.json({ error: "lat / lon が不正です" }, { status: 400 });
  }

  const key = `w:${loc.lat.toFixed(3)}:${loc.lon.toFixed(3)}`;
  const cached = cacheGet<WeatherResponse>(key);
  if (cached) return NextResponse.json(cached);

  const { forecast, marine } = openMeteoUrls(loc.lat, loc.lon);

  const [forecastRes, marineRes] = await Promise.allSettled([
    fetchJson<OpenMeteoRaw>(forecast),
    fetchJson<OpenMeteoRaw>(marine, 15000),
  ]);

  if (forecastRes.status === "rejected") {
    return NextResponse.json(
      {
        error: "天気データを取得できませんでした",
        fallback: "client",
        detail: String(forecastRes.reason).slice(0, 200),
      },
      { status: 502 }
    );
  }

  const payload = buildWeatherPayload(
    forecastRes.value,
    marineRes.status === "fulfilled" ? marineRes.value : null,
    loc.lat,
    loc.lon
  );

  cacheSet(key, payload, TTL.weather);
  return NextResponse.json(payload);
}
