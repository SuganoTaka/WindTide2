import { XMLParser } from "fast-xml-parser";
import { nearestHokkaidoWeekArea } from "./jma-areas";
import type { JmaMarine, JmaMarinePeriod, JmaWarning, JmaWeekly, JmaWeeklyDay } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

/** 全角数字・記号を半角へ（例: ３０ → 30） */
export function normalizeFullWidth(value: string): string {
  return value
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\u3000]/g, " ");
}

/** 「３０ノット（１５メートル）」→ 15 (m/s)。単位が無い場合はノット扱い。 */
export function parseSpeedMs(value: string | number, unit = ""): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return unit.includes("ノット") ? Math.round(value * 0.514444 * 10) / 10 : value;
  }
  const s = normalizeFullWidth(String(value));
  const ms = /(\d+(?:\.\d+)?)\s*(?:m\/s|メートル)/.exec(s);
  if (ms) return Math.round(Number(ms[1]) * 10) / 10;
  const knot = /(\d+(?:\.\d+)?)\s*(?:ノット|kt)/.exec(s);
  if (knot) return Math.round(Number(knot[1]) * 0.514444 * 10) / 10;
  const plain = /(\d+(?:\.\d+)?)/.exec(s);
  if (plain) {
    const n = Number(plain[1]);
    return unit.includes("ノット") ? Math.round(n * 0.514444 * 10) / 10 : n;
  }
  return null;
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = normalizeFullWidth(text(value)).replace(/[^\d.+-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseVisibilityKm(value: unknown, unit = ""): number | null {
  if (typeof value === "object" && value !== null) {
    const attrs = value as Record<string, unknown>;
    if (String(attrs["@_unit"] ?? unit).includes("km")) return parseNumber(text(value));
    if (String(attrs["@_unit"] ?? unit).includes("海里")) {
      const n = parseNumber(text(value));
      return n == null ? null : Math.round(n * 1.852 * 10) / 10;
    }
  }
  return parseNumber(value);
}

const WEATHER_TEXT: Record<string, string> = {
  "100": "晴れ",
  "101": "晴れ時々くもり",
  "102": "晴れ一時雨",
  "103": "晴れ時々雨",
  "104": "晴れ一時雪",
  "105": "晴れ時々雪",
  "108": "晴れ一時雷",
  "110": "晴れ後一時雨",
  "111": "晴れ後時々雨",
  "112": "晴れ後一時雪",
  "113": "晴れ後時々雪",
  "114": "晴れ後雷",
  "115": "晴れ後雨",
  "116": "晴れ後雪",
  "200": "くもり",
  "201": "くもり時々晴れ",
  "202": "くもり一時雨",
  "203": "くもり時々雨",
  "204": "くもり一時雪",
  "205": "くもり時々雪",
  "206": "くもり一時雷",
  "208": "くもり後晴れ",
  "209": "くもり後雨",
  "210": "くもり後雪",
  "300": "雨",
  "301": "雨時々晴れ",
  "302": "雨時々止む",
  "303": "雨時々雪",
  "304": "雨か雪",
  "306": "大雨",
  "308": "雨で暴風を伴う",
  "311": "雨後晴れ",
  "313": "雨後くもり",
  "314": "雨後雪",
  "400": "雪",
  "401": "雪時々晴れ",
  "402": "雪時々止む",
  "403": "雪時々雨",
  "406": "大雪",
  "411": "雪後晴れ",
  "413": "雪後くもり",
  "414": "雪後雨",
  "500": "晴れかくもり",
  "600": "雨か雪",
};

export function jmaWeatherText(code: number | null): string {
  if (code == null) return "—";
  const key = String(code);
  if (WEATHER_TEXT[key]) return WEATHER_TEXT[key];
  const head = Math.floor(code / 100);
  if (head === 1) return "晴れ";
  if (head === 2) return "くもり";
  if (head === 3) return "雨";
  if (head === 4) return "雪";
  if (head === 5) return "晴れかくもり";
  return "—";
}

/** 気象庁の天気コードを、既存の天気アイコン（WMO系）に寄せる */
export function jmaCodeToWmo(code: number | null): number | null {
  if (code == null) return null;
  const head = Math.floor(code / 100);
  if (head === 1) return code === 100 ? 0 : code === 101 || code === 201 ? 2 : 1;
  if (head === 2) return 3;
  if (head === 3) return code === 306 || code === 308 ? 65 : 61;
  if (head === 4) return 73;
  if (head === 6) return 66;
  return 3;
}

export interface WeeklyTarget {
  lat: number;
  lon: number;
}

function weeklyArea(series: Record<string, unknown>): {
  area?: Record<string, unknown>;
  body?: Record<string, unknown>;
} {
  const areas = series.areas;
  if (Array.isArray(areas)) {
    const first = areas[0] as Record<string, unknown> | undefined;
    return { area: first?.area as Record<string, unknown> | undefined, body: first };
  }
  const obj = areas as Record<string, unknown> | undefined;
  return { area: obj?.area as Record<string, unknown> | undefined, body: obj };
}

function hasAreaKey(series: unknown, key: string): boolean {
  if (!series || typeof series !== "object") return false;
  const body = weeklyArea(series as Record<string, unknown>).body;
  return Boolean(body && key in body);
}

/** 短期予報（今日〜明後日）の最低/最高気温を日付ごとに集める */
function collectShortTermTemps(seriesList: unknown): Map<string, { min: number | null; max: number | null }> {
  const map = new Map<string, { min: number | null; max: number | null }>();
  for (const series of asArray(seriesList)) {
    if (!series || typeof series !== "object") continue;
    const ts = series as Record<string, unknown>;
    const times = (ts.timeDefines as string[]) ?? [];
    for (const rawArea of asArray(ts.areas)) {
      if (!rawArea || typeof rawArea !== "object") continue;
      const temps = (rawArea as Record<string, unknown>).temps as unknown[] | undefined;
      if (!Array.isArray(temps)) continue;
      const seen = new Map<string, number>();
      times.forEach((t, i) => {
        const date = t.slice(0, 10);
        const value = parseNumber(temps[i]);
        const count = seen.get(date) ?? 0;
        const current = map.get(date) ?? { min: null, max: null };
        if (count === 0) current.min = value;
        else if (count === 1) current.max = value;
        map.set(date, current);
        seen.set(date, count + 1);
      });
    }
  }
  return map;
}

function fillTemps(
  days: JmaWeeklyDay[],
  filled: Map<string, { min: number | null; max: number | null }>
): JmaWeeklyDay[] {
  return days.map((day) => {
    const extra = filled.get(day.date);
    if (!extra) return day;
    if (day.tempMin != null && day.tempMax != null) return day;
    return {
      ...day,
      tempMin: day.tempMin ?? extra.min,
      tempMax: day.tempMax ?? extra.max,
    };
  });
}

function hokkaidoAreaCode(entry: Record<string, unknown>): string {
  const week = entry.week as Record<string, unknown> | undefined;
  const series = asArray(week?.timeSeries as unknown).find((s) => hasAreaKey(s, "weatherCodes"));
  if (!series) return "";
  return text(weeklyArea(series as Record<string, unknown>).area?.code);
}

function findWeekSeries(
  raw: unknown,
  target?: WeeklyTarget
): { days: JmaWeeklyDay[]; areaName: string; office: string; reportDatetime: string } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const weekEntries = raw.filter(
    (e) => e && typeof e === "object" && "week" in (e as Record<string, unknown>)
  ) as Record<string, unknown>[];

  if (weekEntries.length) {
    let chosen = weekEntries[0];
    if (target) {
      const nearest = nearestHokkaidoWeekArea(target.lat, target.lon);
      const match = weekEntries.find((e) => hokkaidoAreaCode(e) === nearest.code);
      if (match) chosen = match;
    }

    const week = chosen.week as Record<string, unknown>;
    const series = asArray(week.timeSeries as unknown);
    const daySeries = series.find((s) => hasAreaKey(s, "weatherCodes")) as Record<string, unknown> | undefined;
    if (!daySeries) return null;
    const dayArea = weeklyArea(daySeries);
    const tempSeries = series.find((s) => hasAreaKey(s, "tempsMax")) as Record<string, unknown> | undefined;
    const tempBody = tempSeries ? weeklyArea(tempSeries).body : undefined;

    const codes = dayArea.body?.weatherCodes as unknown[] | undefined;
    const pops = dayArea.body?.pops as unknown[] | undefined;
    const rel = dayArea.body?.reliabilities as unknown[] | undefined;
    const tempsMax = tempBody?.tempsMax as unknown[] | undefined;
    const tempsMin = tempBody?.tempsMin as unknown[] | undefined;
    const times = (daySeries.timeDefines as string[]) ?? [];

    const base = times.map((t, i) => ({
      date: t.slice(0, 10),
      code: parseNumber(codes?.[i]),
      text: jmaWeatherText(parseNumber(codes?.[i])),
      pop: parseNumber(pops?.[i]),
      tempMin: parseNumber(tempsMin?.[i]),
      tempMax: parseNumber(tempsMax?.[i]),
      reliability: text(rel?.[i]),
    }));

    const srf = chosen.srf as Record<string, unknown> | undefined;
    const days = fillTemps(base, collectShortTermTemps(srf?.timeSeries));

    return {
      days,
      areaName: text(dayArea.area?.name),
      office: String(week.publishingOffice ?? chosen.name ?? ""),
      reportDatetime: String(week.reportDatetime ?? ""),
    };
  }

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const series = asArray((entry as Record<string, unknown>).timeSeries as unknown);
    const daySeries = series.find((s) => {
      if (!s || typeof s !== "object") return false;
      const obj = s as Record<string, unknown>;
      const times = obj.timeDefines as unknown[] | undefined;
      const firstArea = asArray(obj.areas as unknown)[0] as Record<string, unknown> | undefined;
      return Boolean(times && times.length >= 7 && firstArea && "weatherCodes" in firstArea);
    }) as Record<string, unknown> | undefined;
    if (!daySeries) continue;
    const tempSeries = series.find((s) => {
      if (!s || typeof s !== "object") return false;
      const firstArea = asArray((s as Record<string, unknown>).areas as unknown)[0] as
        | Record<string, unknown>
        | undefined;
      return Boolean(firstArea && "tempsMax" in firstArea);
    }) as Record<string, unknown> | undefined;
    const area = asArray(daySeries.areas as unknown)[0] as Record<string, unknown> | undefined;
    const areaInfo = area?.area as Record<string, unknown> | undefined;
    const codes = area?.weatherCodes as unknown[];
    const pops = area?.pops as unknown[];
    const rel = area?.reliabilities as unknown[];
    const tempArea = asArray(tempSeries?.areas as unknown)[0] as Record<string, unknown> | undefined;
    const tempsMax = tempArea?.tempsMax as unknown[];
    const tempsMin = tempArea?.tempsMin as unknown[];
    const times = (daySeries.timeDefines as string[]) ?? [];

    const base = times.map((t, i) => ({
      date: t.slice(0, 10),
      code: parseNumber(codes?.[i]),
      text: jmaWeatherText(parseNumber(codes?.[i])),
      pop: parseNumber(pops?.[i]),
      tempMin: parseNumber(tempsMin?.[i]),
      tempMax: parseNumber(tempsMax?.[i]),
      reliability: text(rel?.[i]),
    }));

    const shortTerm = (raw[0] as Record<string, unknown> | undefined)?.timeSeries;
    const days = fillTemps(base, collectShortTermTemps(shortTerm));

    return {
      days,
      areaName: text(areaInfo?.name),
      office: String((entry as Record<string, unknown>).publishingOffice ?? ""),
      reportDatetime: String((entry as Record<string, unknown>).reportDatetime ?? ""),
    };
  }
  return null;
}

export function parseWeekly(raw: unknown, target?: WeeklyTarget): JmaWeekly | null {
  const found = findWeekSeries(raw, target);
  if (!found || !found.days.length) return null;
  return {
    office: found.office,
    areaName: found.areaName,
    reportDatetime: found.reportDatetime,
    days: found.days,
  };
}

const PROPERTY_VALUE = (prop: Record<string, unknown>, part: string): Record<string, unknown> | null => {
  const p = prop[part];
  if (!p || typeof p !== "object") return null;
  return p as Record<string, unknown>;
};

function parseMarineKind(kind: Record<string, unknown>): {
  type: string;
  windDir: string;
  windSpeed: number | null;
  weather: string;
  visibilityKm: number | null;
  waveHeight: number | null;
  sentence: string;
} {
  const property = kind.Property as Record<string, unknown> | undefined;
  const type = text(property?.Type);
  const out = {
    type,
    windDir: "",
    windSpeed: null as number | null,
    weather: "",
    visibilityKm: null as number | null,
    waveHeight: null as number | null,
    sentence: "",
  };
  if (!property) return out;

  if (type === "風") {
    const part = PROPERTY_VALUE(property, "WindPart");
    const sub = asArray(part?.SubArea as unknown)[0] as Record<string, unknown> | undefined;
    const base = sub?.Base as Record<string, unknown> | undefined;
    out.sentence = text(sub?.Sentence);
    out.windDir = text(base?.WindDirection);
    const speeds = asArray(base?.WindSpeed as unknown) as Record<string, unknown>[];
    const ms = speeds.find((s) => String(s["@_unit"] ?? "").includes("m/s"));
    const chosen = ms ?? speeds[0];
    if (chosen) {
      const value = parseSpeedMs(text(chosen), String(chosen["@_unit"] ?? ""));
      out.windSpeed = value;
    }
  } else if (type === "天気") {
    const part = PROPERTY_VALUE(property, "WeatherPart");
    const sub = asArray(part?.SubArea as unknown)[0] as Record<string, unknown> | undefined;
    const base = sub?.Base as Record<string, unknown> | undefined;
    out.sentence = text(sub?.Sentence);
    out.weather = text(base?.Weather);
    const local = base?.Local as Record<string, unknown> | undefined;
    const localText = text(local?.Sentence);
    if (localText) out.weather = `${out.weather}（${localText}）`;
  } else if (type === "視程") {
    const part = PROPERTY_VALUE(property, "VisibilityPart");
    const sub = asArray(part?.SubArea as unknown)[0] as Record<string, unknown> | undefined;
    const base = sub?.Base as Record<string, unknown> | undefined;
    out.sentence = text(sub?.Sentence);
    const vis = asArray(base?.Visibility as unknown) as Record<string, unknown>[];
    const km = vis.find((v) => String(v["@_unit"] ?? "").includes("km"));
    out.visibilityKm = km ? parseNumber(text(km)) : vis[0] ? parseVisibilityKm(vis[0], String(vis[0]["@_unit"] ?? "")) : null;
  } else if (type === "波") {
    const part = PROPERTY_VALUE(property, "WaveHeightPart");
    const sub = asArray(part?.SubArea as unknown)[0] as Record<string, unknown> | undefined;
    const base = sub?.Base as Record<string, unknown> | undefined;
    out.sentence = text(sub?.Sentence);
    const wave = asArray(base?.WaveHeight as unknown)[0] as Record<string, unknown> | undefined;
    out.waveHeight = wave ? parseNumber(text(wave)) : null;
  }
  return out;
}

export function parseMarineXml(xml: string, areaCode: string): JmaMarine | null {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return null;
  }
  const report = doc.Report as Record<string, unknown> | undefined;
  if (!report) return null;
  const head = report.Head as Record<string, unknown> | undefined;
  const reportDatetime = String(head?.ReportDateTime ?? "");
  const infosList = asArray(report.Body ? (report.Body as Record<string, unknown>).MeteorologicalInfos : undefined);

  const forecastInfo = infosList.find(
    (i) => i && typeof i === "object" && text((i as Record<string, unknown>)["@_type"]) === "地方海域の予報"
  ) as Record<string, unknown> | undefined;
  if (!forecastInfo) return null;

  const periods: JmaMarinePeriod[] = [];
  let areaName = "";
  let office = "";

  for (const info of asArray(forecastInfo.MeteorologicalInfo)) {
    if (!info || typeof info !== "object") continue;
    const infoObj = info as Record<string, unknown>;
    const label = text(infoObj.Name);
    for (const item of asArray(infoObj.Item)) {
      if (!item || typeof item !== "object") continue;
      const itemObj = item as Record<string, unknown>;
      const area = itemObj.Area as Record<string, unknown> | undefined;
      if (text(area?.Code) !== areaCode) continue;
      areaName = text(area?.Name);
      const period: JmaMarinePeriod = {
        label,
        windDir: "",
        windSpeed: null,
        weather: "",
        visibilityKm: null,
        waveHeight: null,
        sentence: "",
      };
      for (const kind of asArray(itemObj.Kind)) {
        if (!kind || typeof kind !== "object") continue;
        const parsed = parseMarineKind(kind as Record<string, unknown>);
        if (parsed.type === "風") {
          period.windDir = parsed.windDir;
          period.windSpeed = parsed.windSpeed;
          if (parsed.sentence) period.sentence = parsed.sentence;
        } else if (parsed.type === "天気") {
          period.weather = parsed.weather;
        } else if (parsed.type === "視程") {
          period.visibilityKm = parsed.visibilityKm;
        } else if (parsed.type === "波") {
          period.waveHeight = parsed.waveHeight;
        }
      }
      periods.push(period);
    }
  }

  if (!periods.length) return null;
  return {
    areaCode,
    areaName,
    office: office || String(head?.PublishingOffice ?? ""),
    reportDatetime,
    periods,
  };
}

export function parseWarningsXml(xml: string): JmaWarning[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }
  const report = doc.Report as Record<string, unknown> | undefined;
  if (!report) return [];
  const head = report.Head as Record<string, unknown> | undefined;
  if (!head) return [];
  const out: JmaWarning[] = [];
  const headline = head.Headline as Record<string, unknown> | undefined;
  const infos = [...asArray(head.Information), ...asArray(headline?.Information)];
  for (const info of infos) {
    if (!info || typeof info !== "object") continue;
    const infoObj = info as Record<string, unknown>;
    if (text(infoObj["@_type"]) !== "地方海上警報") continue;
    for (const item of asArray(infoObj.Item)) {
      if (!item || typeof item !== "object") continue;
      const itemObj = item as Record<string, unknown>;
      const kind = itemObj.Kind as Record<string, unknown> | undefined;
      const name = text(kind?.Name);
      const code = text(kind?.Code);
      if (!name) continue;
      for (const area of asArray((itemObj.Areas as Record<string, unknown> | undefined)?.Area)) {
        if (!area || typeof area !== "object") continue;
        const areaObj = area as Record<string, unknown>;
        out.push({
          name,
          code,
          areaName: text(areaObj.Name),
          areaCode: text(areaObj.Code),
        });
      }
    }
  }
  return out;
}

export interface FeedEntry {
  title: string;
  link: string;
  updated: string;
}

export function parseFeed(xml: string): FeedEntry[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }
  const feed = doc.feed as Record<string, unknown> | undefined;
  if (!feed) return [];
  const out: FeedEntry[] = [];
  for (const entry of asArray(feed.entry)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const links = asArray(e.link) as Record<string, unknown>[];
    const href = links.map((l) => String(l["@_href"] ?? "")).find((h) => h.includes("/data/"));
    if (!href) continue;
    out.push({
      title: text(e.title),
      link: href,
      updated: text(e.updated),
    });
  }
  return out;
}

/** 地方海上予報・海上警報の電文リンクを官署コードで選ぶ */
export function findFeedLink(entries: FeedEntry[], kind: "予報" | "警報", office: string): string | null {
  const matched = entries
    .filter((e) => e.title.includes("地方海上") && e.title.includes(kind) && e.link.includes(`_${office}.xml`))
    .sort((a, b) => b.updated.localeCompare(a.updated));
  return matched[0]?.link ?? null;
}

export function warningMatchesArea(warnings: JmaWarning[], areaCode: string): JmaWarning[] {
  return warnings.filter(
    (w) => w.areaCode === areaCode || areaCode.startsWith(w.areaCode.slice(0, 2))
  );
}
