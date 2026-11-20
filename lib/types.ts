export type PortKind = "f" | "h";

export type ForecastView = "week" | "month";

export interface Port {
  i: string;
  k: PortKind;
  n: string;
  p: string;
  pc: string;
  r: string;
  t: string;
  tc: number;
  a: string;
  la: number;
  lo: number;
  code: string;
  ol?: number;
  ml?: number;
  d?: string;
  fy?: number;
}

export interface PortDataset {
  generatedAt: string;
  source: {
    name: string;
    fishingPort: string;
    portAndHarbor: string;
    license: string;
  };
  counts: { fishing: number; harbor: number; total: number };
  prefectures: { code: string; name: string }[];
  ports: Port[];
}

export interface TideExtreme {
  t: string;
  hours: number;
  h: number;
  type: "high" | "low";
  estimated?: boolean;
}

export interface TidePoint {
  t: string;
  h: number;
}

export interface TideInfo {
  points: TidePoint[];
  extremes: TideExtreme[];
  todayRange: number | null;
  moonAge: number;
  moonPhase: string;
  moonIllum: number;
  tideName: string;
  tideScore: number;
}

export interface HourPoint {
  t: string;
  wind: number | null;
  windDir: number | null;
  gust: number | null;
  temp: number | null;
  precip: number | null;
  precipProb: number | null;
  wave: number | null;
  seaLevel: number | null;
  code: number | null;
}

export interface DaySummary {
  date: string;
  tideName: string;
  moonAge: number;
  highs: { t: string; h: number }[];
  lows: { t: string; h: number }[];
  maxWind: number | null;
  dominantWindDir: number | null;
  maxGust: number | null;
  sunrise: string | null;
  sunset: string | null;
  inForecastRange: boolean;
  estimated: boolean;
  code: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipProb: number | null;
  waveMax: number | null;
}

export interface WeatherResponse {
  location: { lat: number; lon: number };
  updatedAt: string;
  current: {
    temp: number | null;
    apparent: number | null;
    humidity: number | null;
    pressure: number | null;
    wind: number | null;
    windDir: number | null;
    gust: number | null;
    code: number | null;
    precip: number | null;
    wave: number | null;
    seaTemp: number | null;
  };
  hourly: HourPoint[];
  daily: DaySummary[];
  tide: TideInfo;
  tideAvailable: boolean;
  forecastDays: number;
}

export interface JmaWeeklyDay {
  date: string;
  code: number | null;
  text: string;
  pop: number | null;
  tempMin: number | null;
  tempMax: number | null;
  reliability: string;
}

export interface JmaWeekly {
  office: string;
  areaName: string;
  reportDatetime: string;
  days: JmaWeeklyDay[];
}

export interface JmaMarinePeriod {
  label: string;
  windDir: string;
  windSpeed: number | null;
  weather: string;
  visibilityKm: number | null;
  waveHeight: number | null;
  sentence: string;
}

export interface JmaMarine {
  areaCode: string;
  areaName: string;
  office: string;
  reportDatetime: string;
  periods: JmaMarinePeriod[];
}

export interface JmaWarning {
  name: string;
  code: string;
  areaName: string;
  areaCode: string;
}

export interface JmaResponse {
  weekly: JmaWeekly | null;
  marine: JmaMarine | null;
  warnings: JmaWarning[];
  area: { seaAreaCode: string; seaAreaName: string };
}

export interface LatLon {
  lat: number;
  lon: number;
}
