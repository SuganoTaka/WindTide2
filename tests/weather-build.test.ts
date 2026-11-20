import { describe, expect, it } from "vitest";
import { buildWeatherPayload, FORECAST_DAYS, openMeteoUrls } from "@/lib/weather-build";
import { jstNowLocal, localToMs, msToLocal } from "@/lib/tide";

function makeRaw(hours: number, days: number, withMarine: boolean) {
  const start = jstNowLocal().slice(0, 10);
  const startMs = localToMs(`${start}T00:00`);
  const times = Array.from({ length: hours }, (_, i) => msToLocal(startMs + i * 3600000));
  const dates = Array.from({ length: days }, (_, i) => msToLocal(startMs + i * 86400000).slice(0, 10));

  const forecast = {
    utc_offset_seconds: 32400,
    hourly: {
      time: times,
      temperature_2m: times.map((_, i) => 15 + (i % 6)),
      precipitation: times.map(() => 0),
      precipitation_probability: times.map(() => 20),
      weather_code: times.map(() => 1),
      wind_speed_10m: times.map((_, i) => 3 + (i % 8)),
      wind_direction_10m: times.map(() => 200),
      wind_gusts_10m: times.map((_, i) => 6 + (i % 8)),
    },
    daily: {
      time: dates,
      weather_code: dates.map(() => 1),
      temperature_2m_max: dates.map(() => 21),
      temperature_2m_min: dates.map(() => 13),
      precipitation_probability_max: dates.map(() => 30),
      wind_speed_10m_max: dates.map(() => 8),
      wind_gusts_10m_max: dates.map(() => 12),
      wind_direction_10m_dominant: dates.map(() => 200),
      sunrise: dates.map((d) => `${d}T06:12`),
      sunset: dates.map((d) => `${d}T16:35`),
    },
    current: {
      temperature_2m: 17,
      wind_speed_10m: 5,
      wind_direction_10m: 190,
      weather_code: 1,
    },
  };

  const marine = withMarine
    ? {
        utc_offset_seconds: 32400,
        hourly: {
          time: times,
          wave_height: times.map(() => 0.8),
          sea_level_height_msl: times.map((_, i) => Math.sin((i / 12) * Math.PI * 2) * 1.5),
          sea_surface_temperature: times.map(() => 19),
        },
      }
    : null;

  return { forecast, marine };
}

describe("Open-Meteo 取得層", () => {
  it("16日・m/s・JSTのURLを組み立てる", () => {
    const { forecast, marine } = openMeteoUrls(35.75, 140.84);
    expect(forecast).toContain("forecast_days=16");
    expect(forecast).toContain("wind_speed_unit=ms");
    expect(forecast).toContain("timezone=Asia%2FTokyo");
    expect(marine).toContain("cell_selection=sea");
    expect(FORECAST_DAYS).toBe(16);
  });

  it("16日分の384時間と30日の日別サマリを返す", () => {
    const { forecast, marine } = makeRaw(384, 16, true);
    const data = buildWeatherPayload(forecast, marine, 35.75, 140.84);
    expect(data.hourly).toHaveLength(384);
    expect(data.forecastDays).toBe(16);
    expect(data.daily).toHaveLength(30);
    expect(data.tideAvailable).toBe(true);
    expect(data.tide.points).toHaveLength(384);
    expect(data.daily[0].inForecastRange).toBe(true);
    expect(data.daily[16].inForecastRange).toBe(false);
    expect(data.current.temp).toBe(17);
  });

  it("海洋APIが落ちても気象データだけで動く", () => {
    const { forecast } = makeRaw(384, 16, false);
    const data = buildWeatherPayload(forecast, null, 35.75, 140.84);
    expect(data.hourly).toHaveLength(384);
    expect(data.tideAvailable).toBe(false);
    expect(data.daily[0].maxWind).not.toBeNull();
  });
});
