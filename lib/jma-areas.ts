import { haversineKm } from "./geo";

export interface SeaArea {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

/** 都道府県コード → 気象庁 府県予報区（官署コード） */
export const PREF_OFFICE: Record<string, string> = {
  "01": "010000",
  "02": "020000",
  "03": "030000",
  "04": "040000",
  "05": "050000",
  "06": "060000",
  "07": "070000",
  "08": "080000",
  "09": "090000",
  "10": "100000",
  "11": "110000",
  "12": "120000",
  "13": "130000",
  "14": "140000",
  "15": "150000",
  "16": "160000",
  "17": "170000",
  "18": "180000",
  "19": "190000",
  "20": "200000",
  "21": "210000",
  "22": "220000",
  "23": "230000",
  "24": "240000",
  "25": "250000",
  "26": "260000",
  "27": "270000",
  "28": "280000",
  "29": "290000",
  "30": "300000",
  "31": "310000",
  "32": "320000",
  "33": "330000",
  "34": "340000",
  "35": "350000",
  "36": "360000",
  "37": "370000",
  "38": "380000",
  "39": "390000",
  "40": "400000",
  "41": "410000",
  "42": "420000",
  "43": "430000",
  "44": "440000",
  "45": "450000",
  "46": "460100",
  "47": "471000",
};

/**
 * 気象庁の地方海上予報区（37区）。代表点は各区のおよその中心で、
 * 港は最寄りの区に割り当てる。
 */
export const SEA_AREAS: SeaArea[] = [
  { code: "1010", name: "サハリン東方海上", lat: 48.5, lon: 145.0 },
  { code: "1020", name: "サハリン西方海上", lat: 47.5, lon: 141.5 },
  { code: "1030", name: "網走沖", lat: 44.5, lon: 144.8 },
  { code: "1040", name: "宗谷海峡", lat: 45.6, lon: 141.6 },
  { code: "1050", name: "北海道西方海上", lat: 43.6, lon: 139.5 },
  { code: "1110", name: "北海道東方海上", lat: 43.4, lon: 147.0 },
  { code: "1120", name: "釧路沖", lat: 42.2, lon: 144.6 },
  { code: "1130", name: "日高沖", lat: 41.9, lon: 142.5 },
  { code: "1140", name: "津軽海峡", lat: 41.5, lon: 140.6 },
  { code: "1150", name: "檜山津軽沖", lat: 41.2, lon: 138.9 },
  { code: "2010", name: "三陸沖東部", lat: 39.4, lon: 145.0 },
  { code: "2020", name: "三陸沖西部", lat: 38.9, lon: 142.4 },
  { code: "3010", name: "関東海域北部", lat: 35.4, lon: 141.0 },
  { code: "3020", name: "関東海域南部", lat: 34.2, lon: 139.7 },
  { code: "3110", name: "沿海州南部沖", lat: 41.5, lon: 134.5 },
  { code: "3120", name: "秋田沖", lat: 39.7, lon: 138.8 },
  { code: "3130", name: "佐渡沖", lat: 38.3, lon: 138.2 },
  { code: "3140", name: "能登沖", lat: 37.5, lon: 136.5 },
  { code: "3210", name: "東海海域東部", lat: 34.5, lon: 138.4 },
  { code: "3220", name: "東海海域西部", lat: 34.0, lon: 136.7 },
  { code: "3230", name: "東海海域南部", lat: 33.2, lon: 136.0 },
  { code: "4110", name: "日本海北西部", lat: 39.0, lon: 133.0 },
  { code: "4120", name: "山陰沖東部及び若狭湾付近", lat: 36.0, lon: 134.5 },
  { code: "4130", name: "山陰沖西部", lat: 35.3, lon: 132.4 },
  { code: "4010", name: "瀬戸内海", lat: 34.3, lon: 133.4 },
  { code: "4020", name: "四国沖北部", lat: 33.4, lon: 134.0 },
  { code: "4030", name: "四国沖南部", lat: 32.5, lon: 133.6 },
  { code: "5000", name: "対馬海峡", lat: 34.2, lon: 129.4 },
  { code: "5110", name: "済州島西海上", lat: 33.5, lon: 126.0 },
  { code: "5120", name: "長崎西海上", lat: 32.9, lon: 128.8 },
  { code: "5130", name: "女島南西海上", lat: 31.9, lon: 128.0 },
  { code: "5210", name: "日向灘", lat: 32.0, lon: 132.0 },
  { code: "5220", name: "鹿児島海域", lat: 31.2, lon: 130.3 },
  { code: "5230", name: "奄美海域", lat: 28.6, lon: 129.5 },
  { code: "6010", name: "東シナ海南部", lat: 26.0, lon: 123.8 },
  { code: "6020", name: "沖縄東方海上", lat: 26.4, lon: 129.8 },
  { code: "6030", name: "沖縄南方海上", lat: 24.6, lon: 127.5 },
];

/** 北海道の週間天気は「石狩・上川・釧路」の3区域に分かれる（010000.json） */
export const HOKKAIDO_WEEK_AREAS = [
  { code: "016000", name: "石狩・空知・後志地方", lat: 43.2, lon: 141.3 },
  { code: "012000", name: "上川・留萌地方", lat: 43.8, lon: 142.5 },
  { code: "014000", name: "釧路・根室・十勝地方", lat: 43.0, lon: 144.2 },
];

export function nearestHokkaidoWeekArea(lat: number, lon: number): (typeof HOKKAIDO_WEEK_AREAS)[number] {
  let best = HOKKAIDO_WEEK_AREAS[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const area of HOKKAIDO_WEEK_AREAS) {
    const km = haversineKm({ lat, lon }, { lat: area.lat, lon: area.lon });
    if (km < bestKm) {
      bestKm = km;
      best = area;
    }
  }
  return best;
}

/** 海上予報区コード → 発表官署（地方海上予報 XML の官署コード） */
const SEA_AREA_OFFICE: Record<string, string> = {
  "1010": "016000",
  "1020": "016000",
  "1030": "016000",
  "1040": "016000",
  "1050": "016000",
  "1110": "017000",
  "1120": "017000",
  "1130": "017000",
  "1140": "017000",
  "1150": "017000",
  "2010": "040000",
  "2020": "040000",
  "3010": "130000",
  "3020": "130000",
  "3110": "150000",
  "3120": "150000",
  "3130": "150000",
  "3140": "150000",
  "3210": "230000",
  "3220": "230000",
  "3230": "230000",
  "4110": "260020",
  "4120": "260020",
  "4130": "260020",
  "4010": "280000",
  "4020": "280000",
  "4030": "280000",
  "5000": "400000",
  "5110": "420000",
  "5120": "420000",
  "5130": "420000",
  "5210": "460100",
  "5220": "460100",
  "5230": "460100",
  "6010": "471000",
  "6020": "471000",
  "6030": "471000",
};

export function jmaOfficeOfPref(prefCode: string): string {
  return PREF_OFFICE[prefCode] ?? "130000";
}

export function nearestSeaArea(lat: number, lon: number): SeaArea {
  const me = { lat, lon };
  let best = SEA_AREAS[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const area of SEA_AREAS) {
    const km = haversineKm(me, { lat: area.lat, lon: area.lon });
    if (km < bestKm) {
      bestKm = km;
      best = area;
    }
  }
  return best;
}

export function seaAreaOffice(areaCode: string): string {
  return SEA_AREA_OFFICE[areaCode] ?? "130000";
}
