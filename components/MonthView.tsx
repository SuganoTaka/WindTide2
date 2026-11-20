"use client";

import { useEffect, useMemo, useState } from "react";
import { hourLabel, jstNowLocal, tideNameOfDate, weekdayJa } from "@/lib/tide";
import { windDir16 } from "@/lib/wind";
import type { DaySummary, WeatherResponse } from "@/lib/types";

interface Props {
  data: WeatherResponse;
}

interface Normal {
  month: number;
  avgWind: number | null;
}

const WEEK_HEAD = ["日", "月", "火", "水", "木", "金", "土"];

function tideTone(name: string): string {
  switch (name) {
    case "大潮":
      return "bg-signal/12 text-signal border-signal/30";
    case "中潮":
      return "bg-teal/10 text-teal border-teal/25";
    case "小潮":
      return "bg-ink/5 text-ink-2 border-ink/15";
    default:
      return "bg-gold/10 text-gold border-gold/25";
  }
}

export default function MonthView({ data }: Props) {
  const nowLocal = jstNowLocal();
  const today = nowLocal.slice(0, 10);
  const [cursor, setCursor] = useState({
    y: Number(today.slice(0, 4)),
    m: Number(today.slice(5, 7)),
  });

  const [normal, setNormal] = useState<Normal | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setNormal(null);
    fetch(`/api/normal?lat=${data.location.lat}&lon=${data.location.lon}&month=${cursor.m}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<Normal>) : null))
      .then((json) => {
        if (!ctrl.signal.aborted) setNormal(json);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setNormal(null);
      });
    return () => ctrl.abort();
  }, [data.location.lat, data.location.lon, cursor.m]);

  const byDate = useMemo(() => {
    const map = new Map<string, DaySummary>();
    for (const d of data.daily) map.set(d.date, d);
    return map;
  }, [data.daily]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m - 1, 1));
    const offset = first.getUTCDay();
    const lastDay = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
    const list: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= lastDay; d++) {
      list.push(`${cursor.y}-${String(cursor.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  const shift = (diff: number) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m - 1 + diff, 1));
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="eyebrow">月間カレンダー · 30日</h3>
        <span className="flex-1 h-px bg-rule" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="前月"
            className="px-2 py-1 border border-rule text-[11px] text-ink-2 hover:border-ink-2"
          >
            ←
          </button>
          <span className="num text-[12px] px-2 min-w-[92px] text-center">
            {cursor.y}年{cursor.m}月
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="翌月"
            className="px-2 py-1 border border-rule text-[11px] text-ink-2 hover:border-ink-2"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) })}
            className="px-2 py-1 border border-ink/30 text-[11px] hover:bg-paper"
          >
            今日
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scroll-thin border border-rule bg-paper-2">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-7 bg-paper border-b border-rule">
            {WEEK_HEAD.map((w, i) => (
              <div
                key={w}
                className={[
                  "py-1.5 text-center text-[10px]",
                  i === 0 ? "text-signal/80" : i === 6 ? "text-teal" : "text-ink-3",
                ].join(" ")}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date, i) => {
              if (!date) return <div key={`e${i}`} className="min-h-[112px] border-r border-b border-rule/60 bg-paper/40" />;
              const summary = byDate.get(date);
              const tide = summary ? { name: summary.tideName, moonAge: summary.moonAge } : tideNameOfDate(date);
              const isToday = date === today;
              const weekday = weekdayJa(date);
              const highs = summary?.highs.slice(0, 2) ?? [];
              const lows = summary?.lows.slice(0, 2) ?? [];
              const estimated = Boolean(summary?.estimated);
              return (
                <div
                  key={date}
                  className={[
                    "min-h-[112px] border-r border-b border-rule/60 p-1.5 text-[10px] flex flex-col gap-1",
                    isToday ? "bg-teal/5 ring-1 ring-inset ring-teal/40" : "bg-paper-2",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="num text-[12px] text-ink">{Number(date.slice(8, 10))}</span>
                    <span className="text-[9px] text-ink-3">
                      {weekday}
                      {isToday ? "・今日" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`px-1 py-[1px] border rounded-[1px] text-[9px] ${tideTone(tide.name)}`}>
                      {tide.name}
                    </span>
                    {estimated && <span className="text-[8.5px] text-gold border border-gold/30 px-1 rounded-[1px]">概算</span>}
                  </div>
                  <div className="space-y-[1px] text-[9.5px] leading-tight">
                    {highs.map((h, idx) => (
                      <div key={`h${idx}`} className="flex items-baseline gap-1">
                        <span className="text-gold">満</span>
                        <span className="num">{hourLabel(h.t)}</span>
                        <span className="num text-ink-3 ml-auto">{h.h.toFixed(2)}m</span>
                      </div>
                    ))}
                    {lows.map((l, idx) => (
                      <div key={`l${idx}`} className="flex items-baseline gap-1">
                        <span className="text-ink-3">干</span>
                        <span className="num">{hourLabel(l.t)}</span>
                        <span className="num text-ink-3 ml-auto">{l.h.toFixed(2)}m</span>
                      </div>
                    ))}
                    {!highs.length && !lows.length && <div className="text-ink-3">満干 —</div>}
                  </div>
                  <div className="mt-auto text-[9px] text-ink-2">
                    {summary?.inForecastRange ? (
                      summary.maxWind != null ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="num">{summary.maxWind.toFixed(0)} m/s</span>
                          <span>{windDir16(summary.dominantWindDir)}</span>
                        </span>
                      ) : (
                        <span className="text-ink-3">風 —</span>
                      )
                    ) : summary ? (
                      <span className="text-signal/90">予報範囲外</span>
                    ) : (
                      <span className="text-ink-3">{date < today ? "—" : "予報対象外"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {normal?.avgWind != null && (
        <div className="flex items-center gap-2 text-[10px] text-ink-2">
          <span className="text-ink-3">平年並み（過去5年同月の平均風速）</span>
          <span className="num text-ink">{normal.avgWind.toFixed(1)} m/s</span>
          <div className="relative h-[3px] w-[160px] bg-rule/70 rounded-full" aria-hidden="true">
            <span
              className="absolute -top-[3px] w-[2px] h-[9px] bg-ink"
              style={{ left: `${Math.min(100, Math.max(0, (normal.avgWind / 12) * 100))}%` }}
            />
          </div>
          <span className="text-ink-3">0〜12 m/s</span>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-ink-3">
        <span>風・気象は16日先まで（Open-Meteo）。17日目以降は満干のみ「概算」で表示します。</span>
        <span>「予報範囲外」は風予報が取得できない日、「予報対象外」は30日表示の範囲外です。</span>
      </div>
    </div>
  );
}
