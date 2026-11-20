import { haversineKm } from "./geo";
import type { ForecastView, Port } from "./types";

export function readView(search: string): ForecastView {
  return new URLSearchParams(search).get("view") === "month" ? "month" : "week";
}

export function nearestPort(ports: Port[], lat: number, lon: number): Port | null {
  if (!ports.length || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best: Port | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const port of ports) {
    const km = haversineKm({ lat, lon }, { lat: port.la, lon: port.lo });
    if (km < bestKm) {
      bestKm = km;
      best = port;
    }
  }
  return best;
}

/**
 * 港の指定方法:
 *   - ?port=F01853 / ?p=F01853 （潮見帖からは ?p= をそのまま渡せる）
 *   - ?lat=35.75&lon=140.84 （IDが一致しない場合のフォールバック。最寄り港）
 */
export function resolvePort(ports: Port[], search: string): Port | null {
  const params = new URLSearchParams(search);
  const id = params.get("port") ?? params.get("p");
  if (id) {
    const hit = ports.find((p) => p.i === id);
    if (hit) return hit;
  }
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (params.has("lat") && params.has("lon") && Number.isFinite(lat) && Number.isFinite(lon)) {
    return nearestPort(ports, lat, lon);
  }
  return null;
}
