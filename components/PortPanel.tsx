"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MonthView from "./MonthView";
import OfficialCard from "./OfficialCard";
import WeekView from "./WeekView";
import { formatCoord } from "@/lib/geo";
import { csvFileName, dailyCsv, downloadText, hourlyCsv } from "@/lib/csv";
import { fetchWeatherDirect } from "@/lib/openmeteo-client";
import { addDays, jstNowLocal } from "@/lib/tide";
import { formatDate, meters, portTitle, portTypeLabel } from "@/lib/port";
import type { ForecastView } from "@/lib/types";
import type { JmaResponse, Port, WeatherResponse } from "@/lib/types";

interface Props {
  port: Port;
  view: ForecastView;
  onChangeView: (view: ForecastView) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  embedded?: boolean;
}

export default function PortPanel({
  port,
  view,
  onChangeView,
  isFavorite,
  onToggleFavorite,
  onClose,
  embedded = false,
}: Props) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [jma, setJma] = useState<JmaResponse | null>(null);
  const [jmaLoading, setJmaLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    let directTried = false;

    const loadDirect = async () => {
      directTried = true;
      return fetchWeatherDirect(port.la, port.lo);
    };

    (async () => {
      try {
        const res = await fetch(`/api/weather?lat=${port.la}&lon=${port.lo}`, { signal: ctrl.signal });
        if (res.ok) {
          setData((await res.json()) as WeatherResponse);
          setLoading(false);
          return;
        }
        const direct = await loadDirect();
        if (!ctrl.signal.aborted) {
          setData(direct);
          setLoading(false);
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (!directTried) {
          try {
            const direct = await loadDirect();
            if (!ctrl.signal.aborted) {
              setData(direct);
              setLoading(false);
            }
            return;
          } catch {
            /* 下でエラー表示 */
          }
        }
        if (!ctrl.signal.aborted) {
          setError(String((err as Error)?.message ?? err));
          setLoading(false);
        }
      }
    })();

    return () => ctrl.abort();
  }, [port.la, port.lo, port.i, nonce]);

  useEffect(() => {
    const ctrl = new AbortController();
    setJma(null);
    setJmaLoading(true);
    fetch(`/api/jma?pref=${port.pc}&lat=${port.la}&lon=${port.lo}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<JmaResponse>) : null))
      .then((json) => {
        if (!ctrl.signal.aborted) {
          setJma(json);
          setJmaLoading(false);
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setJma(null);
          setJmaLoading(false);
        }
      });
    return () => ctrl.abort();
  }, [port.pc, port.la, port.lo, port.i]);

  const startDate = data?.daily[0]?.date ?? jstNowLocal().slice(0, 10);
  const periodDays = view === "week" ? 7 : 30;

  const exportHourly = useCallback(() => {
    if (!data) return;
    const days = view === "week" ? 7 : data.forecastDays;
    const from = data.daily[0]?.date ?? startDate;
    const to = addDays(from, days);
    const hours = data.hourly.filter((h) => h.t.slice(0, 10) >= from && h.t.slice(0, 10) < to);
    downloadText(csvFileName(port, from, "hourly"), hourlyCsv(hours));
  }, [data, port, startDate, view]);

  const exportDaily = useCallback(() => {
    if (!data) return;
    const from = data.daily[0]?.date ?? startDate;
    downloadText(csvFileName(port, from, "daily"), dailyCsv(data.daily));
  }, [data, port, startDate]);

  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${portTitle(port)} | WindTide`, url });
        return;
      }
    } catch {
      /* 共有がキャンセルされた場合はクリップボードへ */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [port]);

  const printPeriod = useMemo(() => {
    if (!data) return "";
    const from = data.daily[0]?.date ?? startDate;
    const to = addDays(from, periodDays - 1);
    return `${from.replace(/-/g, "/")} 〜 ${to.replace(/-/g, "/")}（${periodDays}日）`;
  }, [data, startDate, periodDays]);

  return (
    <article className="min-h-full bg-paper-2">
      <div className="print-only px-4 pt-2 pb-1">
        <div className="flex items-baseline justify-between border-b border-ink/40 pb-1">
          <span className="font-display text-[15px]">WindTide 潮見帖フォーキャスト</span>
          <span className="text-[10px]">
            {portTitle(port)}（{port.p}）／ {printPeriod}
          </span>
        </div>
      </div>

      <header className="border-b border-ink/15 bg-paper-2 px-4 sm:px-6 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={[
                  "text-[9.5px] tracking-wider px-1 py-[1px] rounded-[1px] font-semibold",
                  port.k === "f" ? "bg-teal text-paper-2" : "bg-gold text-paper-2",
                ].join(" ")}
              >
                {portTypeLabel(port)}
              </span>
              <span className="text-[10px] text-ink-3">
                {port.p}
                {port.a && port.a !== port.p ? ` ${port.a}` : ""}
              </span>
              <span className="num text-[10px] text-ink-3">{formatCoord(port.la, port.lo)}</span>
            </div>
            <h2 className="mt-1 font-display text-[26px] leading-tight tracking-tight break-words">
              {portTitle(port)}
            </h2>
          </div>
          {!embedded && (
          <button
            type="button"
            onClick={onClose}
            aria-label="港の選択を解除"
            className="shrink-0 -mr-1 -mt-1 p-1.5 text-ink-3 hover:text-ink transition-colors no-print"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 no-print">
          {!embedded && (
            <>
              <button
                type="button"
                onClick={onToggleFavorite}
                aria-pressed={isFavorite}
                className={[
                  "inline-flex items-center gap-1 px-2 py-1 border text-[11px]",
                  isFavorite ? "border-gold text-gold bg-gold/5" : "border-rule text-ink-2 hover:border-ink-2",
                ].join(" ")}
              >
                <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
                {isFavorite ? "お気に入り" : "お気に入りに追加"}
              </button>
              <button
                type="button"
                onClick={share}
                className="px-2 py-1 border border-rule text-[11px] text-ink-2 hover:border-ink-2"
              >
                {copied ? "URLをコピーしました" : "共有"}
              </button>
              <span className="hidden sm:block w-px h-4 bg-rule mx-1" />
            </>
          )}
          <button
            type="button"
            onClick={exportHourly}
            disabled={!data}
            className="px-2 py-1 border border-rule text-[11px] text-ink-2 hover:border-ink-2 disabled:opacity-40"
          >
            CSV（時間別）
          </button>
          <button
            type="button"
            onClick={exportDaily}
            disabled={!data}
            className="px-2 py-1 border border-rule text-[11px] text-ink-2 hover:border-ink-2 disabled:opacity-40"
          >
            CSV（日別）
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data}
            className="px-2 py-1 border border-ink/30 text-[11px] hover:bg-paper disabled:opacity-40"
          >
            印刷 / PDF
          </button>
          {data && (
            <span className="ml-auto text-[9.5px] text-ink-3 num">
              {view === "week" ? "週間" : "月間"} ・ 更新{" "}
              {new Date(data.updatedAt).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        <div
          className={[
            embedded ? "mt-2 flex" : "sm:hidden mt-2 flex",
            "border border-rule rounded-[2px] overflow-hidden no-print",
          ].join(" ")}
          role="tablist"
          aria-label="表示期間"
        >
          {(
            [
              ["week", "週間"],
              ["month", "月間"],
            ] as [ForecastView, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => onChangeView(v)}
              className={[
                "flex-1 py-1.5 text-[11.5px] transition-colors",
                view === v ? "bg-ink text-paper-2" : "text-ink-2 hover:bg-paper",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-5 max-w-[1180px]">
        <div className="print-hide">
          <OfficialCard jma={jma} loading={jmaLoading} />
        </div>

        {loading && (
          <div className="space-y-3" aria-busy="true">
            <div className="h-24 border border-rule chart-paper animate-pulse" />
            <div className="h-40 border border-rule chart-paper animate-pulse" />
            <p className="text-[11px] text-ink-3">気象データを取得しています…</p>
          </div>
        )}

        {!loading && error && (
          <div className="border border-signal/40 bg-paper-2 p-3">
            <p className="text-[12px] font-semibold text-signal">気象データを取得できませんでした</p>
            <p className="mt-1 text-[11px] text-ink-2">{error}</p>
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="mt-2 px-2 py-1 border border-ink/30 text-[11px] hover:bg-paper"
            >
              再試行
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            {view === "week" ? <WeekView data={data} tideFirst={embedded} /> : <MonthView data={data} />}

            <section aria-labelledby="facility-heading" className="print-hide border-t border-rule/70 pt-3">
              <div className="flex items-center gap-2">
                <h3 id="facility-heading" className="eyebrow">
                  施設情報
                </h3>
                <span className="flex-1 h-px bg-rule" />
              </div>
              <dl className="mt-2 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[11.5px]">
                <dt className="text-ink-3">{port.k === "f" ? "漁港コード" : "港湾コード"}</dt>
                <dd className="num">{port.code || "—"}</dd>
                <dt className="text-ink-3">管理者</dt>
                <dd>{port.a || "—"}</dd>
                {port.k === "f" ? (
                  <>
                    <dt className="text-ink-3">指定年月日</dt>
                    <dd className="num">{formatDate(port.d)}</dd>
                    <dt className="text-ink-3">外郭施設</dt>
                    <dd className="num">{meters(port.ol)}</dd>
                    <dt className="text-ink-3">係留施設</dt>
                    <dd className="num">{meters(port.ml)}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-ink-3">外郭施設</dt>
                    <dd className="num">{meters(port.ol)}</dd>
                    <dt className="text-ink-3">係留施設</dt>
                    <dd className="num">{meters(port.ml)}</dd>
                    <dt className="text-ink-3">定期航路</dt>
                    <dd>{port.fy ? "あり" : "なし"}</dd>
                  </>
                )}
              </dl>
            </section>
          </>
        )}

        <footer className="pb-4 pt-3 text-[10px] leading-relaxed text-ink-3 border-t border-rule/70 space-y-1">
          <p>
            潮位・気象はモデル推算値であり、実際の海況と異なる場合があります。出典: 気象データ Open-Meteo ／
            気象庁（週間天気・海上予報）／ 港データ 国土数値情報（国土交通省）
          </p>
          <p className="print-only">
            生成日時: {new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} ／ WindTide
          </p>
        </footer>
      </div>
    </article>
  );
}
