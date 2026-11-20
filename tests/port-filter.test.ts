import { describe, expect, it } from "vitest";
import { filterPorts, hasActiveFilters, normalizeKeyword } from "@/lib/port-filter";
import type { Port } from "@/lib/types";

const ports: Port[] = [
  { i: "F1", k: "f", n: "波崎", p: "茨城県", pc: "08", r: "kanto", t: "第3種", tc: 3, a: "茨城県", la: 35.75, lo: 140.84, code: "1830040" },
  { i: "F2", k: "f", n: "えりも岬", p: "北海道", pc: "01", r: "hokkaido", t: "第1種", tc: 1, a: "北海道", la: 41.93, lo: 143.24, code: "1116140" },
  { i: "H1", k: "h", n: "名洗", p: "千葉県", pc: "12", r: "kanto", t: "地方港湾", tc: 14, a: "千葉県", la: 35.6, lo: 140.7, code: "1200001" },
];

const base = { query: "", kind: "all" as const, pref: "", typeCode: "", me: null, sort: "default" as const };

describe("港の検索・絞り込み", () => {
  it("表記ゆれを吸収する", () => {
    expect(normalizeKeyword("ｴﾘﾓ")).toBe(normalizeKeyword("エリモ"));
    expect(normalizeKeyword("えりも")).toBe(normalizeKeyword("エリモ"));
  });

  it("港名・都道府県で検索できる", () => {
    expect(filterPorts(ports, { ...base, query: "波崎" }).map((p) => p.i)).toEqual(["F1"]);
    expect(filterPorts(ports, { ...base, query: "茨城県" }).map((p) => p.i)).toEqual(["F1"]);
    expect(filterPorts(ports, { ...base, query: "エリモ" }).map((p) => p.i)).toEqual(["F2"]);
    expect(filterPorts(ports, { ...base, query: "千葉 地方" }).map((p) => p.i)).toEqual(["H1"]);
  });

  it("都道府県・種別で絞り込める", () => {
    expect(filterPorts(ports, { ...base, pref: "01" }).map((p) => p.i)).toEqual(["F2"]);
    expect(filterPorts(ports, { ...base, kind: "h" }).map((p) => p.i)).toEqual(["H1"]);
    expect(filterPorts(ports, { ...base, kind: "f", typeCode: "3" }).map((p) => p.i)).toEqual(["F1"]);
  });

  it("現在地から近い順に並ぶ", () => {
    const me = { lat: 35.6, lon: 140.8 };
    const list = filterPorts(ports, { ...base, me, sort: "distance" });
    expect(list[0].i).toBe("H1");
    expect(list[1].i).toBe("F1");
  });

  it("絞り込みの有無を判定する", () => {
    expect(hasActiveFilters(base)).toBe(false);
    expect(hasActiveFilters({ ...base, query: " " })).toBe(false);
    expect(hasActiveFilters({ ...base, pref: "08" })).toBe(true);
  });
});
