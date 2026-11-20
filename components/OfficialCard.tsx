"use client";

import WeatherIcon from "./WeatherIcon";
import { hourLabel, weekdayJa } from "@/lib/tide";
import { jmaCodeToWmo } from "@/lib/jma";
import type { JmaResponse } from "@/lib/types";

interface Props {
  jma: JmaResponse | null;
  loading: boolean;
}

function windText(dir: string, speed: number | null): string {
  if (!dir && speed == null) return "—";
  return `${dir}${speed != null ? ` ${speed.toFixed(0)} m/s` : ""}`;
}

export default function OfficialCard({ jma, loading }: Props) {
  if (loading && !jma) {
    return (
      <div className="border border-rule bg-paper-2 px-3 py-2 text-[10.5px] text-ink-3">
        気象庁の公式情報を取得しています…
      </div>
    );
  }
  if (!jma) return null;

  const warnings = jma.warnings.filter(
    (w, i, arr) => arr.findIndex((x) => x.name === w.name && x.areaName === w.areaName) === i
  );
  const hasWeekly = jma.weekly && jma.weekly.days.length > 0;
  const hasMarine = jma.marine && jma.marine.periods.length > 0;
  if (!warnings.length && !hasWeekly && !hasMarine) return null;

  return (
    <section aria-labelledby="official-heading" className="border border-ink/20 bg-paper-2">
      {warnings.length > 0 && (
        <div className="bg-signal text-paper-2 px-3 py-1.5 flex items-start gap-2 flex-wrap">
          <span className="text-[10px] tracking-wider font-semibold shrink-0">海上警報</span>
          {warnings.map((w) => (
            <span key={`${w.name}-${w.areaName}`} className="text-[10.5px]">
              {w.name}（{w.areaName}）
            </span>
          ))}
        </div>
      )}

      <div className="px-3 py-2.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <h3 id="official-heading" className="eyebrow">
            気象庁の公式情報
          </h3>
          <span className="flex-1 h-px bg-rule" />
          <span className="text-[9.5px] text-ink-3">出典: 気象庁</span>
        </div>

        {hasWeekly && (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[10.5px] text-ink-2">週間天気</span>
              <span className="text-[9.5px] text-ink-3">
                {jma.weekly!.areaName} ・ {jma.weekly!.reportDatetime.slice(5, 16).replace("T", " ")} 発表
              </span>
            </div>
            <div className="mt-1 overflow-x-auto scroll-thin">
              <div className="flex min-w-[560px] border border-rule divide-x divide-rule">
                {jma.weekly!.days.map((d) => (
                  <div key={d.date} className="flex-1 min-w-[76px] px-1.5 py-1 text-center">
                    <div className="text-[9.5px] text-ink-3">
                      {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8, 10))} ({weekdayJa(d.date)})
                    </div>
                    <div className="my-0.5 flex items-center justify-center">
                      <WeatherIcon code={jmaCodeToWmo(d.code)} size={16} className="text-teal" />
                    </div>
                    <div className="text-[9.5px] leading-tight text-ink-2 truncate" title={d.text}>
                      {d.text}
                    </div>
                    <div className="num text-[9px] text-ink-3">
                      {d.pop != null ? `${d.pop}%` : "—"}
                    </div>
                    <div className="num text-[9px]">
                      <span className="text-signal/90">{d.tempMax != null ? `${Math.round(d.tempMax)}` : "—"}</span>
                      <span className="text-ink-3"> / </span>
                      <span className="text-teal">{d.tempMin != null ? `${Math.round(d.tempMin)}` : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasMarine && (
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[10.5px] text-ink-2">海上予報</span>
              <span className="text-[9.5px] text-ink-3">
                {jma.marine!.areaName}（{jma.marine!.areaCode}）・{" "}
                {jma.marine!.reportDatetime.slice(5, 16).replace("T", " ")} 発表
              </span>
            </div>
            <div className="mt-1 grid sm:grid-cols-2 gap-1.5">
              {jma.marine!.periods.map((p) => (
                <div key={p.label} className="border border-rule bg-paper px-2 py-1.5">
                  <div className="text-[9.5px] text-ink-3">{p.label}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px]">
                    <span>
                      <span className="text-ink-3">風 </span>
                      {windText(p.windDir, p.windSpeed)}
                    </span>
                    <span>
                      <span className="text-ink-3">波 </span>
                      {p.waveHeight != null ? `${p.waveHeight.toFixed(1)} m` : "—"}
                    </span>
                    <span>
                      <span className="text-ink-3">視程 </span>
                      {p.visibilityKm != null ? `${p.visibilityKm.toFixed(0)} km` : "—"}
                    </span>
                    <span className="text-ink-2">{p.weather || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[9px] text-ink-3 leading-relaxed">
          数値の時系列・潮位・CSVは Open-Meteo、文章としての公式予報・警報は気象庁を正としています。
          {jma.marine ? `海上予報の発表時刻: ${hourLabel(jma.marine.reportDatetime)}。` : ""}
        </p>
      </div>
    </section>
  );
}
