const DIRS_16 = [
  "北",
  "北北東",
  "北東",
  "東北東",
  "東",
  "東南東",
  "南東",
  "南南東",
  "南",
  "南南西",
  "南西",
  "西南西",
  "西",
  "西北西",
  "北西",
  "北北西",
];

export const DIRS_16_EN = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

export function windDir16(deg: number | null | undefined): string {
  if (deg == null || Number.isNaN(deg)) return "—";
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return DIRS_16[idx];
}

export function windDir16En(deg: number | null | undefined): string {
  if (deg == null || Number.isNaN(deg)) return "—";
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return DIRS_16_EN[idx];
}

/** 矢印は「風が吹いていく向き」なので +180 度 */
export function windArrowDeg(deg: number | null | undefined): number {
  if (deg == null || Number.isNaN(deg)) return 0;
  return (deg + 180) % 360;
}

export function windLevel(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 2) return "ほぼ無風";
  if (ms < 4) return "微風";
  if (ms < 6) return "弱い";
  if (ms < 9) return "やや強い";
  if (ms < 12) return "強い";
  if (ms < 15) return "かなり強い";
  return "危険";
}

export function windTone(ms: number | null | undefined): "calm" | "ok" | "warn" | "bad" {
  if (ms == null) return "ok";
  if (ms < 4) return "calm";
  if (ms < 7) return "ok";
  if (ms < 11) return "warn";
  return "bad";
}
