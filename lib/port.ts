import type { Port } from "./types";

export function portTitle(p: Port): string {
  if (p.n.endsWith("港")) return p.n;
  return p.n + (p.k === "f" ? "漁港" : "港");
}

export function portKindLabel(p: Port): string {
  return p.k === "f" ? "漁港" : "港湾";
}

export function portTypeLabel(p: Port): string {
  return p.t || portKindLabel(p);
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function meters(v?: number): string {
  if (v == null) return "—";
  return `${v.toLocaleString("ja-JP")} m`;
}
