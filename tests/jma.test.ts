import { describe, expect, it } from "vitest";
import {
  jmaWeatherText,
  normalizeFullWidth,
  parseFeed,
  parseMarineXml,
  parseSpeedMs,
  parseWarningsXml,
  parseWeekly,
  warningMatchesArea,
} from "@/lib/jma";

const days7 = [
  "2026-11-21T00:00:00+09:00",
  "2026-11-22T00:00:00+09:00",
  "2026-11-23T00:00:00+09:00",
  "2026-11-24T00:00:00+09:00",
  "2026-11-25T00:00:00+09:00",
  "2026-11-26T00:00:00+09:00",
  "2026-11-27T00:00:00+09:00",
];

describe("気象庁データの正規化", () => {
  it("全角数字とノット表記をm/sへ直す", () => {
    expect(normalizeFullWidth("３０ノット")).toBe("30ノット");
    expect(parseSpeedMs("３０ノット（１５メートル）")).toBe(15);
    expect(parseSpeedMs("45", "ノット")).toBe(23.1);
    expect(parseSpeedMs("23", "m/s")).toBe(23);
  });

  it("天気コードを日本語に直す", () => {
    expect(jmaWeatherText(101)).toBe("晴れ時々くもり");
    expect(jmaWeatherText(306)).toBe("大雨");
    expect(jmaWeatherText(999)).toBe("—");
  });
});

describe("週間天気のパース", () => {
  it("標準形式（府県）から7日分を取り出す", () => {
    const raw = [
      { publishingOffice: "水戸地方気象台", timeSeries: [{ timeDefines: days7.slice(0, 3), areas: [] }] },
      {
        publishingOffice: "水戸地方気象台",
        reportDatetime: "2026-11-20T11:00:00+09:00",
        timeSeries: [
          {
            timeDefines: days7,
            areas: [
              {
                area: { name: "茨城県", code: "080000" },
                weatherCodes: ["101", "201", "300", "101", "101", "101", "101"],
                pops: ["", "10", "60", "20", "20", "20", "30"],
                reliabilities: ["", "", "A", "B", "A", "A", "A"],
              },
            ],
          },
          {
            timeDefines: days7,
            areas: [{ area: { name: "水戸", code: "40201" }, tempsMin: ["5", "7", "9", "8", "6", "5", "4"], tempsMax: ["14", "15", "17", "16", "14", "13", "12"] }],
          },
        ],
      },
    ];
    const weekly = parseWeekly(raw);
    expect(weekly).not.toBeNull();
    expect(weekly!.areaName).toBe("茨城県");
    expect(weekly!.days).toHaveLength(7);
    expect(weekly!.days[0].date).toBe("2026-11-21");
    expect(weekly!.days[0].pop).toBeNull();
    expect(weekly!.days[2].pop).toBe(60);
    expect(weekly!.days[0].tempMax).toBe(14);
    expect(weekly!.days[0].text).toBe("晴れ時々くもり");
  });

  it("北海道は港の緯度経度に近い区域を選び、天気コード・降水確率も読む", () => {
    const makeEntry = (
      office: string,
      name: string,
      areaCode: string,
      areaName: string,
      codes: string[],
      pops: string[],
      baseTemps: { min: string[]; max: string[] }
    ) => ({
      officeCode: office,
      name,
      srf: {
        timeSeries: [
          {
            timeDefines: ["2026-11-20", "2026-11-20", "2026-11-21", "2026-11-21"],
            areas: { area: { name: areaName, code: areaCode }, temps: ["-1", "4", "0", "9"] },
          },
        ],
      },
      week: {
        publishingOffice: name,
        reportDatetime: "2026-11-24T11:00:00+09:00",
        timeSeries: [
          {
            timeDefines: days7,
            areas: { area: { name: areaName, code: areaCode }, weatherCodes: codes, pops, reliabilities: ["", "", "A", "A", "A", "A", "A"] },
          },
          {
            timeDefines: days7,
            areas: { area: { name: areaName, code: areaCode }, tempsMin: baseTemps.min, tempsMax: baseTemps.max },
          },
        ],
      },
    });

    const kushiro = makeEntry("014100", "釧路", "014000", "釧路・根室・十勝地方", ["101", "101", "101", "101", "101", "101", "101"], ["", "10", "10", "10", "10", "10", "10"], { min: ["", "1", "1", "1", "1", "1", "1"], max: ["", "2", "2", "2", "2", "2", "2"] });
    const ishikawa = makeEntry("016000", "札幌", "016000", "石狩・空知・後志地方", ["402", "371", "200", "207", "204", "260", "206"], ["", "80", "40", "60", "50", "50", "50"], { min: ["", "0", "2", "3", "-1", "0", "2"], max: ["", "9", "14", "14", "5", "9", "7"] });

    const weekly = parseWeekly([kushiro, ishikawa], { lat: 43.21, lon: 141.27 });
    expect(weekly!.areaName).toBe("石狩・空知・後志地方");
    expect(weekly!.days[0].code).toBe(402);
    expect(weekly!.days[0].pop).toBeNull();
    expect(weekly!.days[1].pop).toBe(80);
    expect(weekly!.days[0].tempMin).toBe(0);
    expect(weekly!.days[0].tempMax).toBe(9);
    expect(weekly!.days[2].tempMin).toBe(2);
  });

  it("短期予報の気温で週間1日目の欠測を補う", () => {
    const raw = [
      {
        publishingOffice: "水戸地方気象台",
        timeSeries: [
          { timeDefines: ["2026-11-20", "2026-11-21", "2026-11-22"], areas: [{ area: { name: "茨城県" }, weatherCodes: ["100", "100", "100"] }] },
          { timeDefines: ["2026-11-20", "2026-11-20", "2026-11-21", "2026-11-21"], areas: [{ area: { name: "水戸" }, temps: ["3", "12", "5", "14"] }] },
        ],
      },
      {
        publishingOffice: "水戸地方気象台",
        reportDatetime: "2026-11-20T11:00:00+09:00",
        timeSeries: [
          {
            timeDefines: days7,
            areas: [{ area: { name: "茨城県", code: "080000" }, weatherCodes: ["101", "201", "300", "101", "101", "101", "101"], pops: ["", "10", "60", "20", "20", "20", "30"], reliabilities: ["", "", "A", "B", "A", "A", "A"] }],
          },
          {
            timeDefines: days7,
            areas: [{ area: { name: "水戸" }, tempsMin: ["", "7", "9", "8", "6", "5", "4"], tempsMax: ["", "15", "17", "16", "14", "13", "12"] }],
          },
        ],
      },
    ];
    const weekly = parseWeekly(raw);
    expect(weekly!.days[0].date).toBe("2026-11-21");
    expect(weekly!.days[0].tempMin).toBe(5);
    expect(weekly!.days[0].tempMax).toBe(14);
  });

  it("北海道の管内形式からも取り出す", () => {
    const raw = [
      {
        officeCode: "014100",
        name: "釧路",
        week: {
          publishingOffice: "釧路地方気象台",
          reportDatetime: "2026-11-20T11:00:00+09:00",
          timeSeries: [
            {
              timeDefines: days7,
              areas: {
                area: { name: "釧路・根室・十勝地方", code: "014000" },
                weatherCodes: ["101", "101", "206", "101", "101", "101", "101"],
                pops: ["", "10", "20", "60", "20", "20", "20"],
                reliabilities: ["", "", "A", "B", "A", "A", "A"],
              },
            },
            {
              timeDefines: days7,
              areas: {
                area: { name: "釧路", code: "19432" },
                tempsMin: ["-1", "0", "2", "1", "0", "-1", "-2"],
                tempsMax: ["7", "8", "10", "9", "7", "6", "5"],
              },
            },
          ],
        },
      },
    ];
    const weekly = parseWeekly(raw);
    expect(weekly!.areaName).toBe("釧路・根室・十勝地方");
    expect(weekly!.days[0].tempMax).toBe(7);
  });
});

const MARINE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="http://xml.kishou.go.jp/jmaxml1/">
  <Head xmlns="http://xml.kishou.go.jp/jmaxml1/informationBasis1/">
    <ReportDateTime>2026-11-20T07:00:00+09:00</ReportDateTime>
    <PublishingOffice>気象庁</PublishingOffice>
  </Head>
  <Body xmlns="http://xml.kishou.go.jp/jmaxml1/body/meteorology1/">
    <MeteorologicalInfos type="地方海域の予報">
      <MeteorologicalInfo>
        <Name>今日</Name>
        <Item>
          <Area><Name>関東海域北部</Name><Code>3010</Code></Area>
          <Kind><Property><Type>風</Type><WindPart><SubArea><Sentence>西 ４５ノット（２３メートル）</Sentence><Base><WindDirection>西</WindDirection><WindSpeed unit="ノット">45</WindSpeed><WindSpeed unit="m/s">23</WindSpeed></Base></SubArea></WindPart></Property></Kind>
          <Kind><Property><Type>天気</Type><WeatherPart><SubArea><Sentence>晴</Sentence><Base><Weather>晴</Weather></Base></SubArea></WeatherPart></Property></Kind>
          <Kind><Property><Type>視程</Type><VisibilityPart><SubArea><Sentence>５海里（１０キロ）</Sentence><Base><Visibility unit="海里">5</Visibility><Visibility unit="km">10</Visibility></Base></SubArea></VisibilityPart></Property></Kind>
          <Kind><Property><Type>波</Type><WaveHeightPart><SubArea><Sentence>５メートル</Sentence><Base><WaveHeight unit="m">5</WaveHeight></Base></SubArea></WaveHeightPart></Property></Kind>
        </Item>
      </MeteorologicalInfo>
    </MeteorologicalInfos>
  </Body>
</Report>`;

describe("海上予報のパース", () => {
  it("対象海域の風・天気・視程・波を取り出す", () => {
    const marine = parseMarineXml(MARINE_XML, "3010");
    expect(marine).not.toBeNull();
    expect(marine!.areaName).toBe("関東海域北部");
    expect(marine!.periods).toHaveLength(1);
    const p = marine!.periods[0];
    expect(p.label).toBe("今日");
    expect(p.windDir).toBe("西");
    expect(p.windSpeed).toBe(23);
    expect(p.waveHeight).toBe(5);
    expect(p.visibilityKm).toBe(10);
    expect(p.weather).toBe("晴");
  });

  it("別海域を指定した場合は null", () => {
    expect(parseMarineXml(MARINE_XML, "3020")).toBeNull();
  });
});

const WARN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="http://xml.kishou.go.jp/jmaxml1/">
  <Head xmlns="http://xml.kishou.go.jp/jmaxml1/informationBasis1/">
    <Information type="地方海上警報">
      <Item>
        <Kind><Name>海上強風警報</Name><Code>21</Code></Kind>
        <Areas codeType="地方海上予報区"><Area><Name>関東海域</Name><Code>3000</Code></Area></Areas>
      </Item>
    </Information>
  </Head>
</Report>`;

describe("海上警報のパース", () => {
  it("発表中の警報を海域コードで絞り込む", () => {
    const warnings = parseWarningsXml(WARN_XML);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].name).toBe("海上強風警報");
    expect(warningMatchesArea(warnings, "3010")).toHaveLength(1);
    expect(warningMatchesArea(warnings, "4010")).toHaveLength(0);
  });
});

const FEED_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>地方海上予報（Ｈ２８）</title>
    <updated>2026-11-20T02:00:00Z</updated>
    <link type="application/xml" href="https://www.data.jma.go.jp/developer/xml/data/20261120020000_0_VPCY51_130000.xml"/>
  </entry>
  <entry>
    <title>地方海上警報（Ｈ２８）</title>
    <updated>2026-11-20T02:35:00Z</updated>
    <link type="application/xml" href="https://www.data.jma.go.jp/developer/xml/data/20261120023500_0_VPCU51_130000.xml"/>
  </entry>
</feed>`;

describe("フィードのパース", () => {
  it("電文リンクをタイトルと更新時刻付きで返す", () => {
    const entries = parseFeed(FEED_XML);
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toContain("地方海上予報");
    expect(entries[0].link).toContain("VPCY51_130000");
  });
});
