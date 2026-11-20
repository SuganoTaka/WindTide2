"use client";

import WeatherIcon, { weatherLabel } from "./WeatherIcon";
import WindHeatmap, { heatmapDates } from "./WindHeatmap";
import TideChart from "./TideChart";
import { hourLabel, jstNowLocal, weekdayJa } from "@/lib/tide";
import { windDir16 } from "@/lib/wind";
import type { WeatherResponse } from "@/lib/types";

interface Props {
  data: WeatherResponse;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num text-[11px] text-ink mt-0.5">{value}</div>
    </div>
  );
}

export default function WeekView({ data }: Props) {
  const nowLocal = jstNowLocal();
  const startDate = data.daily[0]?.date ?? nowLocal.slice(0, 10);
  const days = data.daily.slice(0, 7);
  const dates = heatmapDates(startDate, 7);
  const hours = data.hourly.filter((h) => dates.includes(h.t.slice(0, 10)));
  const tide = data.tide;

  return (
    <div className="space-y-6">
      <section aria-labelledby="wind-heading">
        <div className="flex items-end gap-2 flex-wrap">
          <h3 id="wind-heading" className="eyebrow">
            風 · 7日 × 24時間
          </h3>
          <span className="flex-1 h-px bg-rule" />
          <span className="text-[10px] text-ink-3">しきい値 10m/s 以上を警告色</span>
        </div>
        <div className="mt-2 border border-rule bg-paper-2 p-2">
          <WindHeatmap hours={hours} dates={dates} />
          <div className="mt-2 flex items-center gap-3 flex-wrap text-[9.5px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-[1px]" style={{ background: "rgb(205 227 222)" }} /> 〜4
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-[1px]" style={{ background: "rgb(120 180 180)" }} /> 4〜8
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-[1px]" style={{ background: "rgb(20 96 107)" }} /> 8〜10
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-[1px]" style={{ background: "rgb(201 132 45)" }} /> 10〜12
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-[1px]" style={{ background: "rgb(170 42 30)" }} /> 12+
            </span>
            <span className="ml-auto">数値は m/s、矢印は風が吹いていく向き</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="daily-heading">
        <div className="flex items-center gap-2">
          <h3 id="daily-heading" className="eyebrow">
            日別サマリ
          </h3>
          <span className="flex-1 h-px bg-rule" />
        </div>
        <div className="mt-2 overflow-x-auto scroll-thin border border-rule">
          <table className="w-full min-w-[720px] border-collapse text-[11px] bg-paper-2">
            <thead>
              <tr className="text-left text-ink-3">
                {["日付", "天気", "最大風速", "最多風向", "最大突風", "日の出", "日の入り"].map((h) => (
                  <th key={h} className="font-normal px-2 py-1.5 border-b border-rule whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-b border-rule/60 last:border-0">
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="num">{Number(d.date.slice(5, 7))}/{Number(d.date.slice(8, 10))}</span>
                    <span className="text-ink-3 ml-1">({weekdayJa(d.date)})</span>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <WeatherIcon code={d.code} size={15} className="text-teal" />
                      <span className="text-[10.5px] text-ink-2">{weatherLabel(d.code)}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 num whitespace-nowrap">
                    {d.maxWind != null ? `${d.maxWind.toFixed(1)} m/s` : "—"}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{windDir16(d.dominantWindDir)}</td>
                  <td className="px-2 py-1.5 num whitespace-nowrap">
                    {d.maxGust != null ? `${d.maxGust.toFixed(1)} m/s` : "—"}
                  </td>
                  <td className="px-2 py-1.5 num whitespace-nowrap">{d.sunrise ? hourLabel(d.sunrise) : "—"}</td>
                  <td className="px-2 py-1.5 num whitespace-nowrap">{d.sunset ? hourLabel(d.sunset) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="tide-heading">
        <div className="flex items-end gap-2 flex-wrap">
          <h3 id="tide-heading" className="eyebrow">
            潮位 · 168時間
          </h3>
          <span className="flex-1 h-px bg-rule" />
          <span className="text-[10px] text-ink-3">
            今日 {tide.tideName} ・ 月齢 {tide.moonAge.toFixed(1)}
          </span>
        </div>
        <div className="mt-2 border border-rule bg-paper-2 p-2">
          {data.tideAvailable ? (
            <TideChart
              points={data.tide.points}
              extremes={data.tide.extremes}
              startDate={startDate}
              hours={168}
              nowLocal={nowLocal}
            />
          ) : (
            <div className="h-[140px] flex items-center justify-center text-[12px] text-ink-3">
              この地点の潮位推算値は取得できませんでした
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-4 text-[9.5px] text-ink-3">
            <span>満潮・干潮は1時間値の極値＋放物線補間（±10分）</span>
            <span>潮位はモデル推算値（MSL基準）</span>
          </div>
        </div>
      </section>

      <section className="print-hide grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-rule/70 pt-3">
        <Stat label="現在の気温" value={data.current.temp != null ? `${data.current.temp.toFixed(1)} ℃` : "—"} />
        <Stat label="現在の風" value={data.current.wind != null ? `${data.current.wind.toFixed(1)} m/s ${windDir16(data.current.windDir)}` : "—"} />
        <Stat label="波高" value={data.current.wave != null ? `${data.current.wave.toFixed(1)} m` : "—"} />
        <Stat label="水温" value={data.current.seaTemp != null ? `${data.current.seaTemp.toFixed(1)} ℃` : "—"} />
      </section>
    </div>
  );
}
