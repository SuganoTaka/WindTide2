import { NextResponse } from "next/server";
import { TTL, cacheGet, cacheSet, fetchJson } from "@/lib/api-cache";
import { meanWind, normalArchiveUrl } from "@/lib/normal";

export const dynamic = "force-dynamic";

interface ArchiveRaw {
  hourly?: { wind_speed_10m?: (number | null)[] };
}

export interface NormalResponse {
  month: number;
  avgWind: number | null;
  years: { year: number; avgWind: number | null }[];
  source: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const month = Number(url.searchParams.get("month"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "lat / lon / month が不正です" }, { status: 400 });
  }

  const key = `normal:${lat.toFixed(2)}:${lon.toFixed(2)}:${month}`;
  const cached = cacheGet<NormalResponse>(key);
  if (cached) return NextResponse.json(cached);

  const thisYear = new Date().getUTCFullYear();
  const targets = [1, 2, 3, 4, 5].map((back) => thisYear - back);

  const results = await Promise.all(
    targets.map(async (year) => {
      try {
        const raw = await fetchJson<ArchiveRaw>(normalArchiveUrl(lat, lon, year, month), 20000);
        return { year, avgWind: meanWind(raw.hourly?.wind_speed_10m) };
      } catch {
        return { year, avgWind: null };
      }
    })
  );

  const values = results.map((r) => r.avgWind).filter((v): v is number => v != null);
  if (!values.length) {
    return NextResponse.json({ error: "平年値を取得できませんでした" }, { status: 502 });
  }

  const payload: NormalResponse = {
    month,
    avgWind: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    years: results,
    source: "Open-Meteo Archive（過去5年同月）",
  };
  cacheSet(key, payload, TTL.normal);
  return NextResponse.json(payload);
}
