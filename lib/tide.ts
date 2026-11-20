import type { DaySummary, HourPoint, TideExtreme, TideInfo, TidePoint } from "./types";

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14, 0);
const JST_OFFSET_MS = 9 * 3600 * 1000;

export function moonAge(nowMs: number): number {
  const days = (nowMs - NEW_MOON_REF) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  return age;
}

export function moonPhaseName(age: number): string {
  if (age < 1.8 || age >= 28.2) return "新月";
  if (age < 5.5) return "三日月";
  if (age < 9.5) return "上弦の月";
  if (age < 13.5) return "十三夜";
  if (age < 16.6) return "満月";
  if (age < 20.5) return "十八夜";
  if (age < 24.0) return "下弦の月";
  if (age < 27.0) return "有明月";
  return "晦日月";
}

export function moonIllumination(age: number): number {
  return (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
}

/** ローカル時刻文字列(YYYY-MM-DDTHH:mm)を、時刻計算用のミリ秒に変換 */
export function localToMs(local: string): number {
  return Date.parse(`${local.length === 16 ? local : local.slice(0, 16)}:00Z`);
}

export function msToLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(
    d.getUTCHours()
  )}:${p(d.getUTCMinutes())}`;
}

export function findExtremes(points: TidePoint[]): TideExtreme[] {
  const out: TideExtreme[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const y0 = points[i - 1].h;
    const y1 = points[i].h;
    const y2 = points[i + 1].h;
    const isHigh = y1 >= y0 && y1 > y2;
    const isLow = y1 <= y0 && y1 < y2;
    if (!isHigh && !isLow) continue;
    const denom = y0 - 2 * y1 + y2;
    let shiftHours = 0;
    if (Math.abs(denom) > 1e-6) {
      shiftHours = (0.5 * (y0 - y2)) / denom;
      shiftHours = Math.max(-0.5, Math.min(0.5, shiftHours));
    }
    shiftHours = isHigh ? -Math.abs(shiftHours) : Math.abs(shiftHours);
    const baseMs = localToMs(points[i].t);
    const tMs = baseMs + shiftHours * 3600000;
    const t = msToLocal(Math.round(tMs / 60000) * 60000);
    out.push({
      t,
      hours: new Date(tMs).getUTCHours() + new Date(tMs).getUTCMinutes() / 60,
      h: Math.round(y1 * 100) / 100,
      type: isHigh ? "high" : "low",
    });
  }
  return out;
}

export function dailyRanges(points: TidePoint[]): Map<string, number> {
  const map = new Map<string, { min: number; max: number }>();
  for (const p of points) {
    const day = p.t.slice(0, 10);
    const cur = map.get(day);
    if (!cur) map.set(day, { min: p.h, max: p.h });
    else {
      cur.min = Math.min(cur.min, p.h);
      cur.max = Math.max(cur.max, p.h);
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of map) out.set(k, Math.round((v.max - v.min) * 100) / 100);
  return out;
}

/**
 * 潮回りは月齢で判定する（仕様書 4.3）。
 * 0〜2 大潮 / 3〜7 中潮 / 8〜10 小潮 / 11〜13 中潮 / 14〜16 大潮 /
 * 17〜20 中潮 / 21〜24 小潮 / 25〜26 長潮 / 27〜28 若潮 / 29 中潮
 */
export function classifyTide(moonAgeDays: number): { name: string; score: number } {
  const wrapped = moonAgeDays % SYNODIC;
  const a = wrapped < 0 ? wrapped + SYNODIC : wrapped;
  if (a < 3) return { name: "大潮", score: 5 };
  if (a < 8) return { name: "中潮", score: 4 };
  if (a < 11) return { name: "小潮", score: 3 };
  if (a < 14) return { name: "中潮", score: 4 };
  if (a < 17) return { name: "大潮", score: 5 };
  if (a < 21) return { name: "中潮", score: 4 };
  if (a < 25) return { name: "小潮", score: 3 };
  if (a < 27) return { name: "長潮", score: 2 };
  if (a < 29) return { name: "若潮", score: 2 };
  return { name: "中潮", score: 4 };
}

export function moonAgeAtLocal(local: string, offsetSeconds = 32400): number {
  return moonAge(localToMs(local) - offsetSeconds * 1000);
}

export function tideNameOfDate(date: string, offsetSeconds = 32400): { name: string; moonAge: number } {
  const age = moonAgeAtLocal(`${date}T12:00`, offsetSeconds);
  return { name: classifyTide(age).name, moonAge: Math.round(age * 10) / 10 };
}

export function buildTideInfo(
  points: TidePoint[],
  nowLocal: string,
  offsetSeconds: number
): TideInfo {
  const nowMs = localToMs(nowLocal) - offsetSeconds * 1000;
  const age = moonAge(nowMs);
  const extremes = findExtremes(points);
  const ranges = dailyRanges(points);
  const today = nowLocal.slice(0, 10);
  const todayRange = ranges.get(today) ?? null;
  const cls = classifyTide(age);
  return {
    points,
    extremes,
    todayRange,
    moonAge: Math.round(age * 10) / 10,
    moonPhase: moonPhaseName(age),
    moonIllum: moonIllumination(age),
    tideName: cls.name,
    tideScore: cls.score,
  };
}

export interface DailyMeta {
  date: string;
  code: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipProb: number | null;
  sunrise: string | null;
  sunset: string | null;
  waveMax: number | null;
}

function dominantDir(hours: HourPoint[]): number | null {
  const bins = new Array(16).fill(0) as number[];
  for (const h of hours) {
    if (h.windDir == null || h.wind == null) continue;
    const idx = Math.round((((h.windDir % 360) + 360) % 360) / 22.5) % 16;
    bins[idx] += 1 + h.wind;
  }
  const max = Math.max(...bins);
  if (max <= 0) return null;
  const idx = bins.indexOf(max);
  return idx * 22.5;
}

/** 日別サマリを作る（16日分の実データ） */
export function buildDailySummaries(
  hourly: HourPoint[],
  extremes: TideExtreme[],
  meta: DailyMeta[],
  offsetSeconds = 32400
): DaySummary[] {
  const byDate = new Map<string, HourPoint[]>();
  for (const h of hourly) {
    const d = h.t.slice(0, 10);
    const list = byDate.get(d);
    if (list) list.push(h);
    else byDate.set(d, [h]);
  }

  const exByDate = new Map<string, TideExtreme[]>();
  for (const e of extremes) {
    if (e.estimated) continue;
    const d = e.t.slice(0, 10);
    const list = exByDate.get(d);
    if (list) list.push(e);
    else exByDate.set(d, [e]);
  }

  return meta.map((m) => {
    const hours = byDate.get(m.date) ?? [];
    const winds = hours.map((h) => h.wind).filter((v): v is number => v != null);
    const gusts = hours.map((h) => h.gust).filter((v): v is number => v != null);
    const ex = (exByDate.get(m.date) ?? []).slice().sort((a, b) => a.t.localeCompare(b.t));
    const tide = tideNameOfDate(m.date, offsetSeconds);
    return {
      date: m.date,
      tideName: tide.name,
      moonAge: tide.moonAge,
      highs: ex.filter((e) => e.type === "high").map((e) => ({ t: e.t, h: e.h })),
      lows: ex.filter((e) => e.type === "low").map((e) => ({ t: e.t, h: e.h })),
      maxWind: winds.length ? Math.max(...winds) : null,
      dominantWindDir: dominantDir(hours),
      maxGust: gusts.length ? Math.max(...gusts) : null,
      sunrise: m.sunrise,
      sunset: m.sunset,
      inForecastRange: true,
      estimated: false,
      code: m.code,
      tempMax: m.tempMax,
      tempMin: m.tempMin,
      precipProb: m.precipProb,
      waveMax: m.waveMax,
    };
  });
}

/**
 * 予報範囲（16日）より先の満干を、直近の極値間隔から外挿する（仕様 4.3 / タスク13）。
 * 返す極値は estimated=true。
 */
export function projectExtremes(extremes: TideExtreme[], lastDate: string, untilDate: string): TideExtreme[] {
  const measured = extremes.filter((e) => !e.estimated);
  if (!measured.length) return [];
  const highs = measured.filter((e) => e.type === "high");
  const lows = measured.filter((e) => e.type === "low");
  if (!highs.length || !lows.length) return [];

  const lastMs = localToMs(extremes[extremes.length - 1]?.t ?? measured[measured.length - 1].t);
  const startMs = Math.max(lastMs, localToMs(`${lastDate}T00:00`));
  const endMs = localToMs(`${untilDate}T23:59`);

  const out: TideExtreme[] = [];
  const project = (list: TideExtreme[], type: "high" | "low") => {
    if (list.length < 2) return;
    const recent = list.slice(-6);
    const intervals: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      intervals.push(localToMs(recent[i].t) - localToMs(recent[i - 1].t));
    }
    const interval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const heights = recent.slice(-3).map((e) => e.h);
    const height = heights.reduce((a, b) => a + b, 0) / heights.length;
    let tMs = localToMs(recent[recent.length - 1].t) + interval;
    while (tMs <= endMs) {
      if (tMs > startMs) {
        out.push({
          t: msToLocal(Math.round(tMs / 60000) * 60000),
          hours: new Date(tMs).getUTCHours() + new Date(tMs).getUTCMinutes() / 60,
          h: Math.round(height * 100) / 100,
          type,
          estimated: true,
        });
      }
      tMs += interval;
    }
  };
  project(highs, "high");
  project(lows, "low");
  return out.sort((a, b) => a.t.localeCompare(b.t));
}

/**
 * 実データの日別サマリを30日分に拡張する。17日目以降は満干を概算し、
 * inForecastRange=false / estimated=true を立てる。
 */
export function extendDailySummaries(
  measured: DaySummary[],
  extremes: TideExtreme[],
  startDate: string,
  totalDays = 30,
  offsetSeconds = 32400
): DaySummary[] {
  const startMs = localToMs(`${startDate}T00:00`);
  const lastMeasuredDate = measured.length ? measured[measured.length - 1].date : startDate;
  const lastTideDate = extremes.length ? extremes[extremes.length - 1].t.slice(0, 10) : lastMeasuredDate;
  const lastDate = msToLocal(startMs + (totalDays - 1) * 86400000).slice(0, 10);
  const projected = projectExtremes(extremes, lastTideDate, lastDate);

  const fill = (d: DaySummary): DaySummary => {
    if (d.highs.length || d.lows.length) return d;
    const ex = projected.filter((e) => e.t.slice(0, 10) === d.date);
    if (!ex.length) return d;
    return {
      ...d,
      highs: ex.filter((e) => e.type === "high").map((e) => ({ t: e.t, h: e.h })),
      lows: ex.filter((e) => e.type === "low").map((e) => ({ t: e.t, h: e.h })),
      estimated: true,
    };
  };

  const out = measured.map(fill);
  const known = new Set(measured.map((d) => d.date));

  for (let i = 0; i < totalDays; i++) {
    const date = msToLocal(startMs + i * 86400000).slice(0, 10);
    if (known.has(date)) continue;
    const tide = tideNameOfDate(date, offsetSeconds);
    const ex = projected.filter((e) => e.t.slice(0, 10) === date);
    out.push({
      date,
      tideName: tide.name,
      moonAge: tide.moonAge,
      highs: ex.filter((e) => e.type === "high").map((e) => ({ t: e.t, h: e.h })),
      lows: ex.filter((e) => e.type === "low").map((e) => ({ t: e.t, h: e.h })),
      maxWind: null,
      dominantWindDir: null,
      maxGust: null,
      sunrise: null,
      sunset: null,
      inForecastRange: false,
      estimated: ex.length > 0,
      code: null,
      tempMax: null,
      tempMin: null,
      precipProb: null,
      waveMax: null,
    });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.slice(0, totalDays);
}

export function jstNowLocal(d = new Date()): string {
  return msToLocal(d.getTime() + JST_OFFSET_MS);
}

export function hourLabel(local: string): string {
  return local.slice(11, 16);
}

export function dayLabel(local: string, todayLocal = jstNowLocal()): string {
  const day = local.slice(0, 10);
  const today = todayLocal.slice(0, 10);
  const t = Date.parse(`${day}T00:00:00Z`);
  const t0 = Date.parse(`${today}T00:00:00Z`);
  const diff = Math.round((t - t0) / 86400000);
  if (diff === 0) return "今日";
  if (diff === 1) return "明日";
  if (diff === 2) return "明後日";
  const d = new Date(`${day}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayJa(local: string): string {
  const d = new Date(`${local.slice(0, 10)}T00:00:00Z`);
  return WEEKDAY[d.getUTCDay()];
}

export function addDays(date: string, days: number): string {
  return msToLocal(localToMs(`${date}T00:00`) + days * 86400000).slice(0, 10);
}

export function monthLabel(date: string): string {
  return `${Number(date.slice(5, 7))}月`;
}
