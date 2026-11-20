import { buildWeatherPayload, openMeteoUrls, type OpenMeteoRaw } from "./weather-build";
import type { WeatherResponse } from "./types";

/**
 * サーバー側の /api/weather が使えない環境（サーバーに外向き通信が無い等）でも
 * 表示できるよう、ブラウザから直接 Open-Meteo を叩くフォールバック。
 * Open-Meteo は CORS を許可している。
 */
export async function fetchWeatherDirect(lat: number, lon: number): Promise<WeatherResponse> {
  const { forecast, marine } = openMeteoUrls(lat, lon);
  const [f, m] = await Promise.all([
    fetch(forecast).then((r) => {
      if (!r.ok) throw new Error(`天気の取得に失敗 (${r.status})`);
      return r.json() as Promise<OpenMeteoRaw>;
    }),
    fetch(marine)
      .then((r) => (r.ok ? (r.json() as Promise<OpenMeteoRaw>) : null))
      .catch(() => null),
  ]);
  return buildWeatherPayload(f, m, lat, lon);
}
