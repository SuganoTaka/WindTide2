/**
 * 主要導線のE2Eスモークテスト（Playwright）
 *
 *   npm run test:e2e                 # http://127.0.0.1:3000 に対して実行
 *   BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 *
 * 外部APIには依存しません。 /api/weather と /api/jma をモックして
 * 「港を選ぶ → 週間ビュー → CSV出力（時間別・日別） → 月間ビュー → 共有URL」を通します。
 * playwright が必要です（この環境では NODE_PATH のものを使用）。
 */
const assert = require("assert");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

function jstDate(offsetDays = 0) {
  const ms = Date.now() + 9 * 3600 * 1000 + offsetDays * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function hhmm(day, hour, minute) {
  return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function makeWeather() {
  const start = jstDate(0);
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const iso = (ms) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  };
  const hourly = Array.from({ length: 384 }, (_, i) => {
    const t = iso(startMs + i * 3600000);
    const wind = i % 30 === 12 ? 12.4 : 3 + (i % 7);
    return {
      t,
      temp: 12 + (i % 9),
      precip: 0,
      precipProb: 20,
      code: 1,
      wind,
      windDir: (i * 10) % 360,
      gust: wind + 3,
      wave: 0.8,
      seaLevel: Math.round(Math.sin((i / 12) * Math.PI * 2) * 100) / 100,
    };
  });

  const daily = Array.from({ length: 30 }, (_, i) => {
    const date = iso(startMs + i * 86400000).slice(0, 10);
    const measured = i < 16;
    const highs = measured
      ? [
          { t: hhmm(date, 5, 12), h: 1.62 },
          { t: hhmm(date, 17, 41), h: 1.58 },
        ]
      : [{ t: hhmm(date, 6, 3), h: 1.5, estimated: true }];
    const lows = measured
      ? [
          { t: hhmm(date, 11, 40), h: 0.21 },
          { t: hhmm(date, 23, 58), h: 0.3 },
        ]
      : [{ t: hhmm(date, 12, 20), h: 0.4, estimated: true }];
    return {
      date,
      tideName: ["大潮", "中潮", "小潮", "長潮", "若潮"][i % 5],
      moonAge: Math.round(((i % 29) + 0.4) * 10) / 10,
      highs,
      lows,
      maxWind: measured ? 6 + (i % 5) : null,
      dominantWindDir: measured ? 180 : null,
      maxGust: measured ? 9 + (i % 4) : null,
      sunrise: measured ? hhmm(date, 6, 12) : null,
      sunset: measured ? hhmm(date, 16, 35) : null,
      inForecastRange: measured,
      estimated: !measured,
      code: measured ? 1 : null,
      tempMax: measured ? 19 : null,
      tempMin: measured ? 11 : null,
      precipProb: measured ? 20 : null,
      waveMax: measured ? 1.1 : null,
    };
  });

  const points = hourly.filter((h) => h.seaLevel != null).map((h) => ({ t: h.t, h: h.seaLevel }));
  const extremes = daily.slice(0, 16).flatMap((d) => [
    ...d.highs.map((h) => ({ t: h.t, hours: 5, h: h.h, type: "high" })),
    ...d.lows.map((l) => ({ t: l.t, hours: 11, h: l.h, type: "low" })),
  ]);

  return {
    location: { lat: 35.75, lon: 140.84 },
    updatedAt: new Date().toISOString(),
    current: { temp: 16.2, apparent: 15.1, humidity: 60, pressure: 1012, wind: 4.2, windDir: 180, gust: 7.1, code: 1, precip: 0, wave: 0.8, seaTemp: 19.2 },
    hourly,
    daily,
    tide: {
      points,
      extremes,
      todayRange: 1.4,
      moonAge: 33.3 % 29.53,
      moonPhase: "上弦の月",
      moonIllum: 0.5,
      tideName: "大潮",
      tideScore: 5,
    },
    tideAvailable: true,
    forecastDays: 16,
  };
}

function makeJma() {
  const start = jstDate(1);
  const startMs = Date.parse(`${start}T00:00:00Z`);
  return {
    weekly: {
      office: "水戸地方気象台",
      areaName: "茨城県",
      reportDatetime: `${jstDate(0)}T11:00:00+09:00`,
      days: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startMs + i * 86400000).toISOString().slice(0, 10);
        return { date: d, code: 101, text: "晴れ時々くもり", pop: 20, tempMin: 8, tempMax: 17, reliability: "A" };
      }),
    },
    marine: {
      areaCode: "3010",
      areaName: "関東海域北部",
      office: "130000",
      reportDatetime: `${jstDate(0)}T07:00:00+09:00`,
      periods: [
        { label: "今日", windDir: "西", windSpeed: 23, weather: "晴", visibilityKm: 10, waveHeight: 5, sentence: "" },
        { label: "明日", windDir: "西", windSpeed: 20, weather: "晴", visibilityKm: 10, waveHeight: 5, sentence: "" },
      ],
    },
    warnings: [
      { name: "海上強風警報", code: "21", areaName: "サハリン東方海上", areaCode: "1010" },
      { name: "海上強風警報", code: "21", areaName: "宗谷海峡", areaCode: "1040" },
      { name: "海上強風警報", code: "21", areaName: "北海道西方海上", areaCode: "1050" },
      { name: "海上濃霧警報", code: "23", areaName: "サハリン西方海上", areaCode: "1020" },
      { name: "海上濃霧警報", code: "23", areaName: "北海道東方海上", areaCode: "1110" },
      { name: "海上着氷警戒", code: "24", areaName: "網走沖", areaCode: "1030" },
      { name: "海上濃霧警報", code: "23", areaName: "釧路沖", areaCode: "1120" },
    ],
    area: { seaAreaCode: "3010", seaAreaName: "関東海域北部" },
  };
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  const weather = makeWeather();
  const jma = makeJma();
  const normal = { month: Number(jstDate(0).slice(5, 7)), avgWind: 4.2, years: [], source: "test" };
  await page.route("**/api/weather?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(weather) })
  );
  await page.route("**/api/jma?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jma) })
  );
  await page.route("**/api/normal?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(normal) })
  );

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  // 1. 港検索 → 選択
  await page.getByRole("searchbox", { name: "港を検索" }).fill("波崎");
  await page.waitForTimeout(200);
  const rows = page.locator('aside ul[aria-label="港の一覧"] > li > button:first-child');
  assert.strictEqual(await rows.count(), 1, "検索結果は1件");
  await rows.first().click();
  await page.waitForTimeout(500);
  assert.ok(page.url().includes("port=F01853"), "URLに港が入る");
  assert.ok(await page.locator("main h2").innerText().then((t) => t.includes("波崎")));

  // 2. 公式情報（気象庁）
  await page.waitForTimeout(300);
  const official = page.locator('section[aria-labelledby="official-heading"]');
  await official.waitFor();
  assert.ok((await official.innerText()).includes("海上強風警報"), "海上警報の赤帯");
  assert.ok((await official.innerText()).includes("他6件"), "警報は1件＋件数に畳む");
  await official.getByRole("button", { name: "他6件" }).click();
  assert.strictEqual(await official.locator("ul li").count(), 6, "展開すると全件表示");
  await official.getByRole("button", { name: "閉じる" }).click();
  assert.strictEqual(await official.locator("ul li").count(), 0, "再度畳める");
  assert.ok((await official.innerText()).includes("関東海域北部"), "海上予報区");
  assert.ok((await official.innerText()).includes("晴れ時々くもり"), "週間天気");

  // 3. 週間ビュー
  await page.locator("#wind-heading").waitFor();
  const cells = page.locator('[title*="m/s"]');
  assert.ok((await cells.count()) >= 168, "風ヒートマップ 7×24");
  const dailyRows = page.locator("table tbody tr");
  assert.strictEqual(await dailyRows.count(), 7, "日別サマリ7行");
  assert.ok(await page.locator('svg[aria-label="168時間の潮位グラフ"]').count());

  // 4. CSV（時間別）
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSV（時間別）" }).click(),
  ]);
  assert.match(download.suggestedFilename(), /^wind-tide_波崎漁港_\d{4}-\d{2}-\d{2}_hourly\.csv$/);
  const hourlyPath = await download.path();
  const hourlyCsv = fs.readFileSync(hourlyPath, "utf8");
  assert.ok(hourlyCsv.startsWith("\uFEFF"), "UTF-8 BOM付き");
  const hourlyLines = hourlyCsv.replace(/^\uFEFF/, "").trim().split("\r\n");
  assert.strictEqual(hourlyLines.length, 169, "168時間 + ヘッダ");
  assert.ok(hourlyLines[0].startsWith("日時,気温(℃),風速(m/s)"));

  // 5. CSV（日別）
  const [download2] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSV（日別）" }).click(),
  ]);
  assert.match(download2.suggestedFilename(), /_daily\.csv$/);
  const dailyCsv = fs.readFileSync(await download2.path(), "utf8");
  const dailyLines = dailyCsv.replace(/^\uFEFF/, "").trim().split("\r\n");
  assert.strictEqual(dailyLines.length, 31, "30日 + ヘッダ");
  assert.ok(dailyLines[0].includes("満潮1,潮位1,満潮2,潮位2"));

  // 6. 月間ビュー
  await page.getByRole("tab", { name: "月間" }).first().click();
  await page.waitForTimeout(300);
  assert.ok(page.url().includes("view=month"));
  const monthText = await page.locator("main").innerText();
  assert.ok(monthText.includes("予報範囲外"), "17日目以降は予報範囲外");
  assert.ok(monthText.includes("概算"), "満干は概算ラベル");
  assert.ok(monthText.includes("30日"), "月間カレンダー");
  assert.ok(monthText.includes("平年並み"), "平年値の基準線");

  // 7. お気に入りと共有URLの永続化
  await page.getByRole("tab", { name: "週間" }).first().click();
  await page.getByRole("button", { name: "お気に入りに追加", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const favButton = page.getByRole("button", { name: "お気に入り", exact: true }).first();
  assert.strictEqual(await favButton.getAttribute("aria-pressed"), "true", "リロード後もお気に入り");
  assert.ok(page.url().includes("port=F01853"), "共有URLで同じ港");
  assert.ok(page.url().includes("view=week"), "共有URLで同じビュー");

  // 8. 印刷レイアウト（画面外の要素を隠す）
  await page.emulateMedia({ media: "print" });
  const asideDisplay = await page.locator("aside").first().evaluate((el) => getComputedStyle(el).display);
  assert.strictEqual(asideDisplay, "none", "印刷時は港一覧を隠す");
  const printHeader = await page.locator(".print-only").first().evaluate((el) => getComputedStyle(el).display);
  assert.strictEqual(printHeader, "block", "印刷用ヘッダを表示");
  await page.emulateMedia({ media: "screen" });

  // 9. モバイル幅
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok(await page.getByRole("button", { name: "港一覧" }).isVisible(), "モバイルで港一覧を開ける");

  // 10. キーボードだけで港選択〜CSV出力まで到達できる
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const focusText = () => page.evaluate(() => document.activeElement?.textContent ?? "");
  let reachedSearch = false;
  for (let i = 0; i < 24; i += 1) {
    const isSearch = await page.evaluate(() => document.activeElement?.getAttribute("type") === "search");
    if (isSearch) {
      reachedSearch = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  assert.ok(reachedSearch, "Tabで検索欄に到達");
  await page.keyboard.type("波崎");
  await page.waitForTimeout(250);

  let selectedByKeyboard = false;
  for (let i = 0; i < 30; i += 1) {
    if ((await focusText()).includes("波崎漁港")) {
      await page.keyboard.press("Enter");
      selectedByKeyboard = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  assert.ok(selectedByKeyboard, "Tab+Enterで港を選択");
  await page.waitForTimeout(500);
  assert.ok(page.url().includes("port=F01853"), "キーボード選択がURLに反映");

  let reachedCsv = false;
  for (let i = 0; i < 40; i += 1) {
    if ((await focusText()).includes("CSV（時間別）")) {
      reachedCsv = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  assert.ok(reachedCsv, "TabでCSV出力ボタンに到達");

  // 11. 埋め込み（潮見帖連携）: ?p= エイリアスとコンパクト表示
  await page.goto(`${BASE}/embed?p=F01853&view=week`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const tideFirst = await page.locator("article").evaluate(
    (el) => el.innerHTML.indexOf("tide-heading") < el.innerHTML.indexOf("wind-heading")
  );
  assert.ok(tideFirst, "埋め込みでは潮位が風より上");
  await page.goto(`${BASE}/embed?p=F01853&view=month`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  assert.ok((await page.locator("main h2, article h2").first().innerText()).includes("波崎漁港"), "?p= で港を解決");
  assert.strictEqual(await page.getByRole("button", { name: "港一覧" }).count(), 0, "埋め込みでは港一覧なし");
  assert.strictEqual(await page.getByRole("button", { name: "お気に入りに追加", exact: true }).count(), 0, "埋め込みではお気に入りなし");
  assert.strictEqual(await page.getByRole("tab", { name: "月間" }).count(), 1, "埋め込みでもタブあり");
  assert.ok((await page.locator("body").innerText()).includes("月間カレンダー"), "月間ビュー表示");
  assert.ok(await page.getByRole("button", { name: "CSV（時間別）" }).isVisible(), "CSV出力は利用可能");

  // 12. 緯度経度フォールバック
  await page.goto(`${BASE}/embed?lat=35.7529&lon=140.8430`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  assert.ok((await page.locator("article h2").first().innerText()).includes("波崎漁港"), "lat/lonで最寄り港");

  assert.deepStrictEqual(errors, [], `console errors: ${errors.join(" | ")}`);
  console.log("E2E OK: 港選択 → 公式情報 → 週間 → CSV(時間別/日別) → 月間 → お気に入り/共有URL → 印刷 → モバイル");
  await browser.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("E2E FAILED:", err.message);
    process.exit(1);
  });
}

module.exports = { makeWeather, makeJma };
