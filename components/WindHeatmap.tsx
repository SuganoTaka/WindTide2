"use client";

import { useMemo } from "react";
import { localToMs, msToLocal } from "@/lib/tide";
import { windArrowDeg } from "@/lib/wind";
import type { HourPoint } from "@/lib/types";

interface Props {
  hours: HourPoint[];
  dates: string[];
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

export function windCellTone(ms: number | null): { bg: string; fg: string; warn: boolean } {
  if (ms == null) return { bg: "rgb(var(--paper))", fg: "rgb(var(--ink-3))", warn: false };
  if (ms < 2) return { bg: "rgb(232 240 236)", fg: "rgb(var(--ink-2))", warn: false };
  if (ms < 4) return { bg: "rgb(205 227 222)", fg: "rgb(var(--ink))", warn: false };
  if (ms < 6) return { bg: "rgb(169 208 203)", fg: "rgb(var(--ink))", warn: false };
  if (ms < 8) return { bg: "rgb(120 180 180)", fg: "rgb(var(--ink))", warn: false };
  if (ms < 10) return { bg: "rgb(20 96 107)", fg: "rgb(var(--paper-2))", warn: false };
  if (ms < 12) return { bg: "rgb(201 132 45)", fg: "rgb(var(--ink))", warn: true };
  return { bg: "rgb(170 42 30)", fg: "rgb(var(--paper-2))", warn: true };
}

function Arrow({ deg, tone }: { deg: number; tone: string }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" style={{ transform: `rotate(${deg}deg)` }}>
      <path d="M5 1.2v7.4M5 1.2L3 3.4M5 1.2l2 2.2" fill="none" stroke={tone} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function WindHeatmap({ hours, dates }: Props) {
  const byTime = useMemo(() => {
    const map = new Map<string, HourPoint>();
    for (const h of hours) map.set(h.t, h);
    return map;
  }, [hours]);

  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="min-w-[700px]">
        <div className="flex">
          <div className="w-[64px] shrink-0" />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 min-w-[24px] text-center eyebrow text-[8.5px] pb-1">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {dates.map((date) => {
          const d = new Date(`${date}T00:00:00Z`);
          return (
            <div key={date} className="flex items-stretch">
              <div className="w-[64px] shrink-0 pr-2 py-1 text-right">
                <div className="num text-[10.5px] text-ink leading-tight">
                  {d.getUTCMonth() + 1}/{d.getUTCDate()}
                </div>
                <div className="text-[9px] text-ink-3">({WEEKDAY[d.getUTCDay()]})</div>
              </div>
              {Array.from({ length: 24 }, (_, h) => {
                const key = `${date}T${String(h).padStart(2, "0")}:00`;
                const point = byTime.get(key) ?? null;
                const tone = windCellTone(point?.wind ?? null);
                return (
                  <div
                    key={h}
                    className="heat-cell flex-1 min-w-[24px] h-[38px] border border-paper-2 flex flex-col items-center justify-center leading-none"
                    style={{ backgroundColor: tone.bg, color: tone.fg }}
                    title={`${date} ${String(h).padStart(2, "0")}:00 風速 ${point?.wind?.toFixed(1) ?? "—"} m/s`}
                  >
                    {point?.windDir != null && <Arrow deg={windArrowDeg(point.windDir)} tone={tone.fg} />}
                    <span className="num text-[9px] mt-[1px]">
                      {point?.wind != null ? Math.round(point.wind) : "—"}
                    </span>
                    {tone.warn && <span className="sr-only">強風注意</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function heatmapDates(startDate: string, days = 7): string[] {
  const start = localToMs(`${startDate}T00:00`);
  return Array.from({ length: days }, (_, i) => msToLocal(start + i * 86400000).slice(0, 10));
}
