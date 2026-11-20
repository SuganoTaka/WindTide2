import { describe, expect, it } from "vitest";
import { csvFileName, dailyCsv, hourlyCsv } from "@/lib/csv";
import type { DaySummary, HourPoint, Port } from "@/lib/types";

const port: Port = { i: "F1", k: "f", n: "波崎", p: "茨城県", pc: "08", r: "kanto", t: "第3種", tc: 3, a: "茨城県", la: 35.75, lo: 140.84, code: "1830040" };

const hours: HourPoint[] = [
  { t: "2026-11-20T00:00", temp: 15.2, precip: 0, precipProb: 20, code: 1, wind: 3.4, windDir: 180, gust: 6.1, wave: 0.8, seaLevel: 1.23 },
  { t: "2026-11-20T01:00", temp: 15.0, precip: 0.4, precipProb: 30, code: 2, wind: null, windDir: null, gust: null, wave: null, seaLevel: null },
];

const days: DaySummary[] = [
  {
    date: "2026-11-20",
    tideName: "大潮",
    moonAge: 1.2,
    highs: [{ t: "2026-11-20T05:12", h: 1.62 }],
    lows: [{ t: "2026-11-20T11:45", h: 0.22 }],
    maxWind: 8.4,
    dominantWindDir: 180,
    maxGust: 12.1,
    sunrise: "2026-11-20T06:12",
    sunset: "2026-11-20T16:35",
    inForecastRange: true,
    estimated: false,
    code: 1,
    tempMax: 19,
    tempMin: 11,
    precipProb: 20,
    waveMax: 1.1,
  },
];

describe("CSV 出力", () => {
  it("時間別CSVはUTF-8 BOM付きで仕様どおりの列を持つ", () => {
    const csv = hourlyCsv(hours);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("日時,気温(℃),風速(m/s),風向,風向(度),突風(m/s),降水量(mm),降水確率(%),波高(m),潮位(m)");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("2026-11-20 00:00,15.2,3.4,南,180,6.1,0.0,20,0.8,1.23");
    expect(lines[2].split(",")[2]).toBe("");
  });

  it("日別CSVは満干2回までを列に持つ", () => {
    const csv = dailyCsv(days);
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("日付,曜日,潮回り,満潮1,潮位1,満潮2,潮位2,干潮1,潮位1,干潮2,潮位2,最大風速,最多風向,最大突風,日の出,日の入り");
    const cells = lines[1].split(",");
    expect(cells[0]).toBe("2026-11-20");
    expect(cells[1]).toBe("金");
    expect(cells[2]).toBe("大潮");
    expect(cells[3]).toBe("05:12");
    expect(cells[4]).toBe("1.62");
    expect(cells[11]).toBe("8.4");
    expect(cells[12]).toBe("南");
    expect(cells[15]).toBe("16:35");
  });

  it("ファイル名は wind-tide_{港名}_{開始日}", () => {
    expect(csvFileName(port, "2026-11-20", "hourly")).toBe("wind-tide_波崎漁港_2026-11-20_hourly.csv");
  });
});
