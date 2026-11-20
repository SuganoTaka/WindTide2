/** 平年値（過去5年同月の平均風速）関連のユーティリティ */

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function meanWind(values: (number | null | undefined)[] | undefined): number | null {
  if (!values?.length) return null;
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.round(mean * 10) / 10;
}

export function normalArchiveUrl(lat: number, lon: number, year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-${String(lastDayOfMonth(year, month)).padStart(2, "0")}`;
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: start,
    end_date: end,
    timezone: "Asia/Tokyo",
    wind_speed_unit: "ms",
    hourly: "wind_speed_10m",
  });
  return `https://archive-api.open-meteo.com/v1/archive?${q.toString()}`;
}
