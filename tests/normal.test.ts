import { describe, expect, it } from "vitest";
import { lastDayOfMonth, meanWind, normalArchiveUrl } from "@/lib/normal";

describe("平年値", () => {
  it("月の最終日を返す", () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2024, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 11)).toBe(30);
  });

  it("欠測を除いた平均風速を小数1桁で返す", () => {
    expect(meanWind([3, 4, null, 5])).toBe(4);
    expect(meanWind([null, undefined])).toBeNull();
    expect(meanWind([2.44, 2.46])).toBe(2.5);
  });

  it("Archive APIのURLを組み立てる", () => {
    const url = normalArchiveUrl(35.75, 140.84, 2025, 11);
    expect(url).toContain("archive-api.open-meteo.com");
    expect(url).toContain("start_date=2025-11-01");
    expect(url).toContain("end_date=2025-11-30");
    expect(url).toContain("wind_speed_unit=ms");
  });
});
