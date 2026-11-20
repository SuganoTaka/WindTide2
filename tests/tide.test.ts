import { describe, expect, it } from "vitest";
import {
  buildDailySummaries,
  classifyTide,
  extendDailySummaries,
  findExtremes,
  localToMs,
  moonAge,
  msToLocal,
  projectExtremes,
  tideNameOfDate,
} from "@/lib/tide";
import type { HourPoint, TideExtreme } from "@/lib/types";

const START = "2026-11-20T00:00";

function hourlySeries(hours: number): HourPoint[] {
  const start = localToMs(START);
  return Array.from({ length: hours }, (_, i) => {
    const t = msToLocal(start + i * 3600000);
    const h = Math.sin((i / 12) * 2 * Math.PI);
    return {
      t,
      wind: 3 + (i % 5),
      windDir: 180,
      gust: 5,
      temp: 18,
      precip: 0,
      precipProb: 10,
      wave: 0.6,
      seaLevel: Math.round(h * 100) / 100,
      code: 1,
    };
  });
}

describe("moon age / tide name", () => {
  it("朔の基準時刻で月齢0になる", () => {
    expect(moonAge(Date.UTC(2000, 0, 6, 18, 14))).toBeCloseTo(0, 6);
  });

  it("仕様書4.3の潮回り境界に一致する", () => {
    const cases: [number, string][] = [
      [0, "大潮"],
      [2.9, "大潮"],
      [3, "中潮"],
      [7.9, "中潮"],
      [8, "小潮"],
      [10.9, "小潮"],
      [11, "中潮"],
      [13.9, "中潮"],
      [14, "大潮"],
      [16.9, "大潮"],
      [17, "中潮"],
      [20.9, "中潮"],
      [21, "小潮"],
      [24.9, "小潮"],
      [25, "長潮"],
      [26.9, "長潮"],
      [27, "若潮"],
      [28.9, "若潮"],
      [29, "中潮"],
    ];
    for (const [age, name] of cases) {
      expect(classifyTide(age).name, `age=${age}`).toBe(name);
    }
  });

  it("日付から潮回りを引ける", () => {
    const tide = tideNameOfDate("2026-11-20");
    expect(tide.name).toBeTruthy();
    expect(tide.moonAge).toBeGreaterThanOrEqual(0);
    expect(tide.moonAge).toBeLessThan(29.6);
  });
});

describe("findExtremes", () => {
  it("1時間値の極値を放物線補間して±10分以内で返す", () => {
    const points = hourlySeries(49).map((h) => ({ t: h.t, h: h.seaLevel ?? 0 }));
    const extremes = findExtremes(points);
    const highs = extremes.filter((e) => e.type === "high");
    expect(highs.length).toBeGreaterThanOrEqual(3);
    expect(highs[0].t.endsWith("T03:00")).toBe(true);
    const diffMin = Math.abs(localToMs(highs[0].t) - localToMs("2026-11-20T03:00")) / 60000;
    expect(diffMin).toBeLessThanOrEqual(10);
  });
});

describe("17日目以降の概算", () => {
  it("直近の極値間隔から外挿し estimated=true を立てる", () => {
    const points = hourlySeries(24 * 16).map((h) => ({ t: h.t, h: h.seaLevel ?? 0 }));
    const extremes = findExtremes(points);
    const lastDate = extremes[extremes.length - 1].t.slice(0, 10);
    const projected = projectExtremes(extremes, lastDate, "2026-12-19");
    expect(projected.length).toBeGreaterThan(0);
    expect(projected.every((e) => e.estimated)).toBe(true);
    for (let i = 1; i < projected.length; i++) {
      expect(projected[i].t > projected[i - 1].t).toBe(true);
    }
  });

  it("日別サマリを30日に拡張し、17日目以降を予報範囲外にする", () => {
    const hours = hourlySeries(24 * 16);
    const points = hours.map((h) => ({ t: h.t, h: h.seaLevel ?? 0 }));
    const extremes = findExtremes(points);
    const meta = Array.from({ length: 16 }, (_, i) => {
      const date = msToLocal(localToMs(START) + i * 86400000).slice(0, 10);
      return {
        date,
        code: 1,
        tempMax: 20,
        tempMin: 12,
        precipProb: 20,
        sunrise: `${date}T06:12`,
        sunset: `${date}T16:34`,
        waveMax: 1.2,
      };
    });
    const measured = buildDailySummaries(hours, extremes, meta);
    expect(measured).toHaveLength(16);
    expect(measured[0].inForecastRange).toBe(true);
    expect(measured[0].highs.length).toBeGreaterThan(0);

    const extended = extendDailySummaries(measured, extremes, START, 30);
    expect(extended).toHaveLength(30);
    expect(extended[15].inForecastRange).toBe(true);
    expect(extended[16].inForecastRange).toBe(false);
    expect(extended[16].maxWind).toBeNull();
    expect(extended[16].estimated).toBe(true);
    expect(extended[16].highs.length + extended[16].lows.length).toBeGreaterThan(0);
  });
});

describe("潮位データが短い場合の補完", () => {
  it("満干が取れない日は概算で埋める（予報範囲内は維持）", () => {
    const hours = hourlySeries(24 * 10);
    const points = hours.map((h) => ({ t: h.t, h: h.seaLevel ?? 0 }));
    const extremes = findExtremes(points);
    const meta = Array.from({ length: 16 }, (_, i) => ({
      date: msToLocal(localToMs(START) + i * 86400000).slice(0, 10),
      code: 1,
      tempMax: 20,
      tempMin: 12,
      precipProb: 20,
      sunrise: null,
      sunset: null,
      waveMax: null,
    }));
    const measured = buildDailySummaries(hours, extremes, meta);
    expect(measured[12].highs.length).toBe(0);
    const extended = extendDailySummaries(measured, extremes, START, 30);
    expect(extended[12].inForecastRange).toBe(true);
    expect(extended[12].estimated).toBe(true);
    expect(extended[12].highs.length + extended[12].lows.length).toBeGreaterThan(0);
  });
});
