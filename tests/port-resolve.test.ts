import { describe, expect, it } from "vitest";
import { nearestPort, readView, resolvePort } from "@/lib/port-resolve";
import type { Port } from "@/lib/types";

const ports: Port[] = [
  { i: "F01853", k: "f", n: "波崎", p: "茨城県", pc: "08", r: "kanto", t: "第3種", tc: 3, a: "茨城県", la: 35.752913, lo: 140.842954, code: "1830040" },
  { i: "F02745", k: "f", n: "えりも岬", p: "北海道", pc: "01", r: "hokkaido", t: "第1種", tc: 1, a: "北海道", la: 41.935676, lo: 143.244766, code: "1116140" },
];

describe("港の指定解決（潮見帖連携）", () => {
  it("?port= と ?p= の両方を受け付ける", () => {
    expect(resolvePort(ports, "?port=F01853")?.i).toBe("F01853");
    expect(resolvePort(ports, "?p=F02745")?.i).toBe("F02745");
  });

  it("IDが見つからない場合は lat/lon の最寄り港にフォールバック", () => {
    expect(resolvePort(ports, "?port=UNKNOWN&lat=35.75&lon=140.84")?.i).toBe("F01853");
    expect(resolvePort(ports, "?lat=41.9&lon=143.2")?.i).toBe("F02745");
  });

  it("指定が無い・不正なときは null", () => {
    expect(resolvePort(ports, "")).toBeNull();
    expect(resolvePort(ports, "?lat=abc&lon=xyz")).toBeNull();
    expect(resolvePort([], "?port=F01853")).toBeNull();
  });

  it("view を week/month で解釈する", () => {
    expect(readView("?view=month")).toBe("month");
    expect(readView("?view=week")).toBe("week");
    expect(readView("?view=unknown")).toBe("week");
  });

  it("最寄り港を距離で選ぶ", () => {
    expect(nearestPort(ports, 35.7, 140.8)?.i).toBe("F01853");
    expect(nearestPort([], 35.7, 140.8)).toBeNull();
  });
});
