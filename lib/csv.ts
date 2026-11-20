import { hourLabel, weekdayJa } from "./tide";
import { portTitle } from "./port";
import { windDir16 } from "./wind";
import type { DaySummary, HourPoint, Port } from "./types";

const BOM = "\uFEFF";

function n(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toFixed(digits);
}

function deg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Math.round(value));
}

export function hourlyCsv(hours: HourPoint[]): string {
  const header = "日時,気温(℃),風速(m/s),風向,風向(度),突風(m/s),降水量(mm),降水確率(%),波高(m),潮位(m)";
  const rows = hours.map((h) =>
    [
      h.t.replace("T", " "),
      n(h.temp),
      n(h.wind),
      windDir16(h.windDir),
      deg(h.windDir),
      n(h.gust),
      n(h.precip),
      h.precipProb == null ? "" : String(Math.round(h.precipProb)),
      n(h.wave),
      n(h.seaLevel, 2),
    ].join(",")
  );
  return BOM + [header, ...rows].join("\r\n") + "\r\n";
}

function hhmm(local: string | null): string {
  if (!local) return "";
  return hourLabel(local);
}

export function dailyCsv(days: DaySummary[]): string {
  const header =
    "日付,曜日,潮回り,満潮1,潮位1,満潮2,潮位2,干潮1,潮位1,干潮2,潮位2,最大風速,最多風向,最大突風,日の出,日の入り";
  const rows = days.map((d) => {
    const highs = d.highs.slice(0, 2);
    const lows = d.lows.slice(0, 2);
    return [
      d.date,
      weekdayJa(d.date),
      d.tideName,
      hhmm(highs[0]?.t ?? null),
      n(highs[0]?.h, 2),
      hhmm(highs[1]?.t ?? null),
      n(highs[1]?.h, 2),
      hhmm(lows[0]?.t ?? null),
      n(lows[0]?.h, 2),
      hhmm(lows[1]?.t ?? null),
      n(lows[1]?.h, 2),
      n(d.maxWind),
      windDir16(d.dominantWindDir),
      n(d.maxGust),
      hhmm(d.sunrise),
      hhmm(d.sunset),
    ].join(",");
  });
  return BOM + [header, ...rows].join("\r\n") + "\r\n";
}

export function csvFileName(port: Port, startDate: string, kind: "hourly" | "daily"): string {
  const name = portTitle(port).replace(/[\\/:*?"<>|]/g, "");
  return `wind-tide_${name}_${startDate}_${kind === "hourly" ? "hourly" : "daily"}.csv`;
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
