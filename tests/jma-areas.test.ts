import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PREF_OFFICE,
  SEA_AREAS,
  jmaOfficeOfPref,
  nearestSeaArea,
  seaAreaOffice,
} from "@/lib/jma-areas";
import type { PortDataset } from "@/lib/types";

describe("気象庁区域マッピング", () => {
  it("47都道府県すべてに府県予報区がある", () => {
    expect(Object.keys(PREF_OFFICE)).toHaveLength(47);
    expect(jmaOfficeOfPref("08")).toBe("080000");
    expect(jmaOfficeOfPref("46")).toBe("460100");
    expect(jmaOfficeOfPref("47")).toBe("471000");
  });

  it("海上予報区は一意で、すべて発表官署に紐づく", () => {
    const codes = SEA_AREAS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const area of SEA_AREAS) {
      expect(seaAreaOffice(area.code)).toMatch(/^\d{6}$/);
    }
  });

  it("3,925港すべてに府県予報区と海上予報区が割り当たる", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "public/data/ports.json"), "utf-8");
    const dataset = JSON.parse(raw) as PortDataset;
    expect(dataset.ports).toHaveLength(3925);
    let assigned = 0;
    for (const port of dataset.ports) {
      expect(jmaOfficeOfPref(port.pc)).toMatch(/^\d{6}$/);
      const area = nearestSeaArea(port.la, port.lo);
      expect(area.name.length).toBeGreaterThan(0);
      expect(seaAreaOffice(area.code)).toMatch(/^\d{6}$/);
      assigned += 1;
    }
    expect(assigned / dataset.ports.length).toBeGreaterThanOrEqual(0.95);
  });
});
