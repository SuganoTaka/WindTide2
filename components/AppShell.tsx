"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar, { type KindFilter } from "./Sidebar";
import PortPanel from "./PortPanel";
import { filterPorts, hasActiveFilters, type PortSort } from "@/lib/port-filter";
import { readView, resolvePort } from "@/lib/port-resolve";
import { loadFavorites, toggleFavorite } from "@/lib/storage";
import type { ForecastView, LatLon, Port, PortDataset } from "@/lib/types";

const KIND_TYPE_CODES = {
  f: [
    { code: "1", label: "第1種" },
    { code: "2", label: "第2種" },
    { code: "3", label: "第3種" },
    { code: "4", label: "第4種" },
    { code: "5", label: "第5種" },
  ],
  h: [
    { code: "11", label: "国際戦略港湾" },
    { code: "12", label: "国際拠点港湾" },
    { code: "13", label: "重要港湾" },
    { code: "14", label: "地方港湾" },
    { code: "15", label: "その他港湾" },
  ],
};

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" className="shrink-0">
      <circle cx="15" cy="15" r="13.4" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
      <path
        d="M2.4 17.6c3.1 0 3.1-2.6 6.2-2.6s3.1 2.6 6.2 2.6 3.1-2.6 6.2-2.6 3.1 2.6 6.2 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M2.4 22.6c3.1 0 3.1-2.6 6.2-2.6s3.1 2.6 6.2 2.6 3.1-2.6 6.2-2.6 3.1 2.6 6.2 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path d="M15 6.6v4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="15" cy="13" r="1.7" fill="currentColor" />
    </svg>
  );
}

export default function AppShell() {
  const [dataset, setDataset] = useState<PortDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [pref, setPref] = useState("");
  const [typeCode, setTypeCode] = useState("");

  const [me, setMe] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sort, setSort] = useState<PortSort>("default");

  const [selected, setSelected] = useState<Port | null>(null);
  const [view, setView] = useState<ForecastView>("week");
  const [listOpen, setListOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/data/ports.json")
      .then(async (r) => {
        if (!r.ok) throw new Error(`港データの取得に失敗 (${r.status})`);
        return (await r.json()) as PortDataset;
      })
      .then((ports) => {
        if (!alive) return;
        setDataset(ports);
        setLoading(false);
        const hit = resolvePort(ports.ports, window.location.search);
        if (hit) setSelected(hit);
        setView(readView(window.location.search));
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(String(err?.message ?? err));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const writeUrl = useCallback((port: Port | null, nextView: ForecastView) => {
    try {
      const params = new URLSearchParams();
      if (port) {
        params.set("port", port.i);
        params.set("view", nextView);
      }
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    } catch {
      /* noop */
    }
  }, []);

  const locate = useCallback((sortAfter = true) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("このブラウザは位置情報に対応していません");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating(false);
        if (sortAfter) setSort("distance");
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "位置情報の利用が許可されていません。ブラウザの設定から許可してください。"
            : "現在地を取得できませんでした。電波状況を確認して再度お試しください。"
        );
      },
      { timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  const selectPort = useCallback(
    (p: Port) => {
      setSelected(p);
      setListOpen(false);
      writeUrl(p, view);
    },
    [view, writeUrl]
  );

  const onToggleFavorite = useCallback((id: string) => {
    setFavorites(toggleFavorite(id));
  }, []);

  const changeView = useCallback(
    (next: ForecastView) => {
      setView(next);
      writeUrl(selected, next);
    },
    [selected, writeUrl]
  );

  const closeDetail = useCallback(() => {
    setSelected(null);
    writeUrl(null, view);
  }, [view, writeUrl]);

  const ports = useMemo(() => dataset?.ports ?? [], [dataset]);

  const favoritePorts = useMemo(() => {
    const byId = new Map(ports.map((p) => [p.i, p]));
    return favorites.map((id) => byId.get(id)).filter((p): p is Port => Boolean(p));
  }, [ports, favorites]);


  const typeOptions = useMemo(() => {
    if (kind === "f") return KIND_TYPE_CODES.f;
    if (kind === "h") return KIND_TYPE_CODES.h;
    return [...KIND_TYPE_CODES.f, ...KIND_TYPE_CODES.h];
  }, [kind]);

  const filtersActive = useMemo(
    () => hasActiveFilters({ query, kind, pref, typeCode }),
    [query, kind, pref, typeCode]
  );

  const filtered = useMemo(
    () => filterPorts(ports, { query, kind, pref, typeCode, me, sort }),
    [ports, query, kind, pref, typeCode, me, sort]
  );

  const onKind = (v: KindFilter) => {
    setKind(v);
    setTypeCode("");
  };

  const resetFilters = useCallback(() => {
    setQuery("");
    setKind("all");
    setPref("");
    setTypeCode("");
  }, []);

  const toggleSort = useCallback(() => {
    if (sort === "distance") {
      setSort("default");
      return;
    }
    if (me) {
      setSort("distance");
      return;
    }
    locate();
  }, [sort, me, locate]);

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-paper">
      <header className="no-print shrink-0 h-[var(--header-h)] border-b border-ink/15 bg-paper-2/95 backdrop-blur-sm z-[950]">
        <div className="h-full px-3 sm:px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={closeDetail}
            className="flex items-center gap-2 text-ink text-left"
            aria-label="ホームに戻る"
          >
            <BrandMark />
            <span className="leading-none">
              <span className="font-display text-[17px] tracking-[0.02em]">WindTide</span>
              <span className="ml-2 hidden sm:inline eyebrow align-middle">潮見帖フォーキャスト</span>
            </span>
          </button>

          <span className="hidden md:block h-6 w-px bg-rule mx-1" />

          <span className="hidden md:flex items-center gap-1.5 text-[10.5px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-[7px] h-[7px] rounded-full bg-teal" /> 漁港
              <span className="num ml-0.5">{dataset?.counts.fishing.toLocaleString("ja-JP") ?? "—"}</span>
            </span>
            <span className="inline-flex items-center gap-1 ml-2">
              <span className="w-[7px] h-[7px] rounded-[1px] bg-gold" /> 港湾
              <span className="num ml-0.5">{dataset?.counts.harbor.toLocaleString("ja-JP") ?? "—"}</span>
            </span>
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div
              className="hidden sm:flex border border-rule rounded-[2px] overflow-hidden"
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
                  onClick={() => changeView(v)}
                  className={[
                    "px-3 py-1.5 text-[11.5px] transition-colors",
                    view === v ? "bg-ink text-paper-2" : "text-ink-2 hover:bg-paper",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => locate()}
              disabled={locating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-ink/30 text-[11.5px] hover:border-ink hover:bg-paper transition-colors disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <circle cx="6" cy="6" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6 0.8v2M6 9.2v2M0.8 6h2M9.2 6h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {locating ? "取得中…" : "現在地"}
            </button>
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="lg:hidden px-2.5 py-1.5 bg-ink text-paper-2 text-[11.5px]"
            >
              港一覧
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 relative flex">
        <aside className="no-print hidden lg:block w-[352px] xl:w-[376px] shrink-0 min-h-0">
          <Sidebar
            ports={filtered}
            total={ports.length}
            loading={loading}
            query={query}
            onQuery={setQuery}
            kind={kind}
            onKind={onKind}
            pref={pref}
            onPref={setPref}
            typeCode={typeCode}
            onTypeCode={setTypeCode}
            prefectures={dataset?.prefectures ?? []}
            typeOptions={typeOptions}
            sort={sort}
            onToggleSort={toggleSort}
            filtersActive={filtersActive}
            onResetFilters={resetFilters}
            favoriteIds={favorites}
            favoritePorts={favoritePorts}
            onToggleFavorite={onToggleFavorite}
            me={me}
            onLocate={() => locate(false)}
            locating={locating}
            selectedId={selected?.i ?? null}
            onSelect={selectPort}
          />
        </aside>

        {listOpen && (
          <div className="no-print lg:hidden fixed inset-0 z-[1000] bg-ink/30" onClick={() => setListOpen(false)}>
            <div
              className="absolute inset-x-0 bottom-0 top-[10vh] bg-paper-2 anim-rise"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar
                ports={filtered}
                total={ports.length}
                loading={loading}
                query={query}
                onQuery={setQuery}
                kind={kind}
                onKind={onKind}
                pref={pref}
                onPref={setPref}
                typeCode={typeCode}
                onTypeCode={setTypeCode}
                prefectures={dataset?.prefectures ?? []}
                typeOptions={typeOptions}
                sort={sort}
                onToggleSort={toggleSort}
                filtersActive={filtersActive}
                onResetFilters={resetFilters}
                favoriteIds={favorites}
                favoritePorts={favoritePorts}
                    onToggleFavorite={onToggleFavorite}
                me={me}
                onLocate={() => locate(false)}
                locating={locating}
                selectedId={selected?.i ?? null}
                onSelect={selectPort}
                onClose={() => setListOpen(false)}
              />
            </div>
          </div>
        )}

        <main className="relative flex-1 min-w-0 min-h-0 overflow-y-auto scroll-thin chart-paper">
          {loadError && (
            <div className="absolute inset-0 z-[600] flex items-center justify-center bg-paper chart-paper p-6">
              <div className="border border-signal/40 bg-paper-2 p-4 max-w-md">
                <p className="text-[13px] font-semibold text-signal">データを読み込めませんでした</p>
                <p className="mt-1 text-[11.5px] text-ink-2">{loadError}</p>
              </div>
            </div>
          )}

          {locationError && !selected && (
            <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[600] max-w-[92%]">
              <div className="flex items-start gap-2 bg-paper-2 border border-signal/40 px-3 py-2 shadow-panel">
                <span className="text-[11px] text-ink-2">{locationError}</span>
                <button
                  type="button"
                  onClick={() => setLocationError(null)}
                  aria-label="閉じる"
                  className="text-ink-3 hover:text-ink shrink-0"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {selected ? (
            <PortPanel
              port={selected}
              view={view}
              onChangeView={changeView}
              isFavorite={favorites.includes(selected.i)}
              onToggleFavorite={() => onToggleFavorite(selected.i)}
              onClose={closeDetail}
            />
          ) : (
            !loadError && (
              <div className="h-full min-h-[360px] flex items-center justify-center px-6">
                <div className="max-w-[420px] text-center">
                  <p className="eyebrow">WindTide</p>
                  <h1 className="mt-2 font-display text-[26px] leading-snug tracking-tight">
                    港を選ぶと、風と潮の予報が
                    <br className="hidden sm:block" />
                    週間・月間で読めます
                  </h1>
                  <p className="mt-3 text-[12px] leading-relaxed text-ink-2">
                    全国 {dataset ? dataset.counts.total.toLocaleString("ja-JP") : "—"} 港から選んでください。
                    左の一覧で港名・都道府県を絞り込めます。
                  </p>
                  <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10.5px] text-ink-3">
                    <span>風・気温・降水</span>
                    <span aria-hidden="true">·</span>
                    <span>潮位・満干潮</span>
                    <span aria-hidden="true">·</span>
                    <span>日の出・日の入り</span>
                  </div>
                </div>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
}
