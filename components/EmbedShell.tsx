"use client";

import { useCallback, useEffect, useState } from "react";
import PortPanel from "./PortPanel";
import { readView, resolvePort } from "@/lib/port-resolve";
import { loadFavorites, toggleFavorite } from "@/lib/storage";
import type { ForecastView, Port, PortDataset } from "@/lib/types";

export default function EmbedShell() {
  const [dataset, setDataset] = useState<PortDataset | null>(null);
  const [selected, setSelected] = useState<Port | null>(null);
  const [view, setView] = useState<ForecastView>("week");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFavorites(loadFavorites());
    let alive = true;
    fetch("/data/ports.json")
      .then(async (r) => {
        if (!r.ok) throw new Error(`港データの取得に失敗 (${r.status})`);
        return (await r.json()) as PortDataset;
      })
      .then((data) => {
        if (!alive) return;
        setDataset(data);
        setSelected(resolvePort(data.ports, window.location.search));
        setView(readView(window.location.search));
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(String((err as Error)?.message ?? err));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const changeView = useCallback(
    (next: ForecastView) => {
      setView(next);
      if (!selected) return;
      try {
        const params = new URLSearchParams();
        params.set("port", selected.i);
        params.set("view", next);
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      } catch {
        /* noop */
      }
    },
    [selected]
  );

  const onToggleFavorite = useCallback((id: string) => {
    setFavorites(toggleFavorite(id));
  }, []);

  return (
    <div className="min-h-dvh bg-paper chart-paper">
      {loading && (
        <div className="p-6 text-[12px] text-ink-3">港データを読み込んでいます…</div>
      )}

      {!loading && error && (
        <div className="p-6">
          <p className="text-[13px] font-semibold text-signal">予報を表示できません</p>
          <p className="mt-1 text-[11.5px] text-ink-2">{error}</p>
        </div>
      )}

      {!loading && !error && selected && (
        <div className="mx-auto max-w-[1180px] min-h-dvh bg-paper-2">
          <PortPanel
            port={selected}
            view={view}
            onChangeView={changeView}
            isFavorite={favorites.includes(selected.i)}
            onToggleFavorite={() => onToggleFavorite(selected.i)}
            onClose={() => undefined}
            embedded
          />
        </div>
      )}

      {!loading && !error && !selected && (
        <div className="p-6 max-w-[560px]">
          <p className="eyebrow">WindTide</p>
          <h1 className="mt-1 font-display text-[20px]">港が指定されていません</h1>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-2">
            <code className="font-mono">?port=F01853</code> または <code className="font-mono">?p=F01853</code>、
            もしくは <code className="font-mono">?lat=35.75&amp;lon=140.84</code> を付けて開いてください。
          </p>
          <a
            href="/"
            className="mt-3 inline-block px-3 py-1.5 border border-ink/30 text-[11.5px] hover:bg-paper"
            target="_blank"
            rel="noopener"
          >
            WindTideを開く
          </a>
        </div>
      )}
    </div>
  );
}
