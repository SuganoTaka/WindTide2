import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

export const TTL = {
  weather: 15 * 60 * 1000,
  jmaForecast: 30 * 60 * 1000,
  jmaWarning: 5 * 60 * 1000,
  normal: 24 * 60 * 60 * 1000,
} as const;

type Entry = { t: number; v: unknown; ttl: number };

const store = new Map<string, Entry>();

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > hit.ttl) {
    store.delete(key);
    return null;
  }
  return hit.v as T;
}

export function cacheSet(key: string, value: unknown, ttl = TTL.weather): void {
  if (store.size > 400) {
    const oldest = [...store.entries()].sort((a, b) => a[1].t - b[1].t)[0];
    if (oldest) store.delete(oldest[0]);
  }
  store.set(key, { t: Date.now(), v: value, ttl });
}

/**
 * 社内プロキシ配下で動かす場合に備え、HTTPS_PROXY などが設定されていれば
 * それ経由で外部 API を叩く。未設定なら通常の fetch と同じ挙動。
 */
let dispatcher: Dispatcher | undefined;
let dispatcherInitialized = false;

function getDispatcher(): Dispatcher | undefined {
  if (dispatcherInitialized) return dispatcher;
  dispatcherInitialized = true;
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (proxy && noProxy !== "*") {
    try {
      dispatcher = new ProxyAgent(proxy);
    } catch {
      dispatcher = undefined;
    }
  }
  return dispatcher;
}

export async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const d = getDispatcher();
  const res = await undiciFetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json" },
    ...(d ? { dispatcher: d } : {}),
  });
  if (!res.ok) {
    throw new Error(`upstream ${res.status} ${res.statusText ?? ""}`.trim());
  }
  return (await res.json()) as T;
}

export function parseLatLon(url: URL): { lat: number; lon: number } | null {
  const rawLat = url.searchParams.get("lat");
  const rawLon = url.searchParams.get("lon");
  if (rawLat === null || rawLon === null || rawLat === "" || rawLon === "") return null;
  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const d = getDispatcher();
  const res = await undiciFetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "text/csv,text/plain,*/*" },
    ...(d ? { dispatcher: d } : {}),
  });
  if (!res.ok) {
    throw new Error(`upstream ${res.status} ${res.statusText ?? ""}`.trim());
  }
  return await res.text();
}
