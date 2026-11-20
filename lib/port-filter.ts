import { haversineKm } from "./geo";
import type { LatLon, Port, PortKind } from "./types";

export type PortSort = "default" | "distance";

export interface PortFilterOptions {
  query: string;
  kind: "all" | PortKind;
  pref: string;
  typeCode: string;
  me: LatLon | null;
  sort: PortSort;
}

const HIRAGANA = /[\u3041-\u3096]/g;

/** 全角/半角・大文字小文字・ひらがな/カタカナの揺れを吸収する */
export function normalizeKeyword(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(HIRAGANA, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

function searchIndex(port: Port): string {
  return normalizeKeyword(`${port.n}${port.p}${port.a}${port.code}${port.t}`);
}

export function filterPorts(ports: Port[], options: PortFilterOptions): Port[] {
  const tokens = options.query
    .split(/\s+/)
    .map((t) => normalizeKeyword(t.trim()))
    .filter(Boolean);

  let list = ports;
  if (options.kind !== "all") list = list.filter((p) => p.k === options.kind);
  if (options.pref) list = list.filter((p) => p.pc === options.pref);
  if (options.typeCode) list = list.filter((p) => String(p.tc) === options.typeCode);
  if (tokens.length) {
    list = list.filter((p) => {
      const hay = searchIndex(p);
      return tokens.every((t) => hay.includes(t));
    });
  }

  if (options.sort === "distance" && options.me) {
    const me = options.me;
    list = [...list].sort(
      (a, b) => haversineKm(me, { lat: a.la, lon: a.lo }) - haversineKm(me, { lat: b.la, lon: b.lo })
    );
  }

  return list;
}

export function hasActiveFilters(options: Pick<PortFilterOptions, "query" | "kind" | "pref" | "typeCode">): boolean {
  return Boolean(options.query.trim() || options.kind !== "all" || options.pref || options.typeCode);
}
