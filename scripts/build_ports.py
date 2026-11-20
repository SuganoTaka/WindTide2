#!/usr/bin/env python3
"""
国土交通省「国土数値情報」から漁港・港湾の座標データを生成する。

入力 (data/source/*.zip):
  - C09-06_GML.zip : 漁港 (漁港漁場整備法にもとづく第1〜5種漁港) 約2,900件
  - C02-14_GML.zip : 港湾 (港湾法にもとづく港湾) 約990件

出力:
  - public/data/ports.json

依存ライブラリなし (標準ライブラリのみで .shp / .dbf を直接読む)。

使い方:
  python3 scripts/build_ports.py
"""

from __future__ import annotations

import json
import os
import struct
import zipfile
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "data", "source")
OUT_PATH = os.path.join(ROOT, "public", "data", "ports.json")
ENCODING = "cp932"  # DBF の属性値は Shift_JIS

PREFECTURES = [
    ("01", "北海道"), ("02", "青森県"), ("03", "岩手県"), ("04", "宮城県"),
    ("05", "秋田県"), ("06", "山形県"), ("07", "福島県"), ("08", "茨城県"),
    ("09", "栃木県"), ("10", "群馬県"), ("11", "埼玉県"), ("12", "千葉県"),
    ("13", "東京都"), ("14", "神奈川県"), ("15", "新潟県"), ("16", "富山県"),
    ("17", "石川県"), ("18", "福井県"), ("19", "山梨県"), ("20", "長野県"),
    ("21", "岐阜県"), ("22", "静岡県"), ("23", "愛知県"), ("24", "三重県"),
    ("25", "滋賀県"), ("26", "京都府"), ("27", "大阪府"), ("28", "兵庫県"),
    ("29", "奈良県"), ("30", "和歌山県"), ("31", "鳥取県"), ("32", "島根県"),
    ("33", "岡山県"), ("34", "広島県"), ("35", "山口県"), ("36", "徳島県"),
    ("37", "香川県"), ("38", "愛媛県"), ("39", "高知県"), ("40", "福岡県"),
    ("41", "佐賀県"), ("42", "長崎県"), ("43", "熊本県"), ("44", "大分県"),
    ("45", "宮崎県"), ("46", "鹿児島県"), ("47", "沖縄県"),
]
PREF_NAME = dict(PREFECTURES)

# 魚の季節カレンダー (data/fish-species.json) が使う地域区分
REGION_OF_PREF = {
    "01": "hokkaido",
    "02": "tohoku", "03": "tohoku", "04": "tohoku", "05": "tohoku",
    "06": "tohoku", "07": "tohoku",
    "08": "kanto", "09": "kanto", "10": "kanto", "11": "kanto",
    "12": "kanto", "13": "kanto", "14": "kanto",
    "15": "chubu", "16": "chubu", "17": "chubu", "18": "chubu",
    "19": "chubu", "20": "chubu", "21": "chubu", "22": "chubu", "23": "chubu",
    "24": "kinki", "25": "kinki", "26": "kinki", "27": "kinki",
    "28": "kinki", "29": "kinki", "30": "kinki",
    "31": "chushikoku", "32": "chushikoku", "33": "chushikoku",
    "34": "chushikoku", "35": "chushikoku", "36": "chushikoku",
    "37": "chushikoku", "38": "chushikoku", "39": "chushikoku",
    "40": "kyushu", "41": "kyushu", "42": "kyushu", "43": "kyushu",
    "44": "kyushu", "45": "kyushu", "46": "kyushu",
    "47": "okinawa",
}

FISHING_PORT_TYPE = {
    "0": "不明", "1": "第1種", "2": "第2種", "3": "第3種",
    "4": "第4種", "5": "第5種", "6": "特定第3種",
}

HARBOR_TYPE = {
    "11": "国際戦略港湾",
    "12": "国際拠点港湾",
    "13": "重要港湾",
    "14": "地方港湾",
    "15": "その他港湾",
}


# --------------------------------------------------------------------------
# Shapefile / DBF リーダ (点データ専用の最小実装)
# --------------------------------------------------------------------------
def read_dbf(raw: bytes) -> list[dict]:
    if len(raw) < 32:
        return []
    n_records = struct.unpack("<I", raw[4:8])[0]
    header_len = struct.unpack("<H", raw[8:10])[0]
    record_len = struct.unpack("<H", raw[10:12])[0]

    fields: list[tuple[str, int]] = []
    pos = 32
    while pos < header_len - 1 and raw[pos] != 0x0D:
        name = raw[pos:pos + 11].split(b"\x00")[0].decode("ascii", "ignore")
        length = raw[pos + 16]
        fields.append((name, length))
        pos += 32

    out = []
    off = header_len
    for _ in range(n_records):
        chunk = raw[off:off + record_len]
        off += record_len
        if len(chunk) < record_len:
            break
        if chunk[:1] == b"*":  # 削除フラグ
            continue
        cursor = 1
        row = {}
        for name, length in fields:
            val = chunk[cursor:cursor + length]
            cursor += length
            row[name] = val.decode(ENCODING, "replace").strip()
        out.append(row)
    return out


def read_shp_points(raw: bytes) -> list[tuple[float, float] | None]:
    shape_type = struct.unpack("<i", raw[32:36])[0]
    if shape_type != 1:
        raise ValueError(f"Point shapefile ではありません (shapeType={shape_type})")
    points: list[tuple[float, float] | None] = []
    off = 100
    while off + 8 <= len(raw):
        content_len = struct.unpack(">i", raw[off + 4:off + 8])[0] * 2
        body = raw[off + 8:off + 8 + content_len]
        off += 8 + content_len
        if len(body) < 20:
            points.append(None)
            continue
        st = struct.unpack("<i", body[0:4])[0]
        if st == 0:  # Null Shape
            points.append(None)
            continue
        x, y = struct.unpack("<dd", body[4:20])
        points.append((round(y, 6), round(x, 6)))  # (lat, lon)
    return points


def load_layer(zip_path: str, inner_shp: str, inner_dbf: str):
    with zipfile.ZipFile(zip_path) as zf:
        shp = zf.read(inner_shp)
        dbf = zf.read(inner_dbf)
    return read_shp_points(shp), read_dbf(dbf)


# --------------------------------------------------------------------------
def pref_code_of(admin_area_code: str) -> str:
    return (admin_area_code or "")[:2]


def build_fishing_ports() -> list[dict]:
    points, records = load_layer(
        os.path.join(SRC_DIR, "C09-06_GML.8bdc55af.zip"),
        "C09-06_FishingPort.shp",
        "C09-06_FishingPort.dbf",
    )
    ports = []
    for idx, (row, pt) in enumerate(zip(records, points)):
        if pt is None:
            continue
        code = row.get("C09_001", "")
        name = row.get("C09_002", "")
        admin_code = row.get("C09_003", "")
        type_code = row.get("C09_004", "")
        pref_code = pref_code_of(admin_code)
        item = {
            "i": f"F{idx:05d}",
            "k": "f",
            "n": name,
            "p": PREF_NAME.get(pref_code, ""),
            "pc": pref_code,
            "r": REGION_OF_PREF.get(pref_code, "kanto"),
            "t": FISHING_PORT_TYPE.get(type_code, "漁港"),
            "tc": int(type_code) if type_code.isdigit() else 0,
            "a": row.get("C09_006", ""),
            "la": pt[0],
            "lo": pt[1],
            "code": code,
        }
        ol = row.get("C09_009", "")
        ml = row.get("C09_010", "")
        if ol.isdigit():
            item["ol"] = int(ol)
        if ml.isdigit():
            item["ml"] = int(ml)
        d = row.get("C09_007", "")
        if len(d) == 10:
            item["d"] = d
        ports.append(item)
    return ports


def build_harbors() -> list[dict]:
    points, records = load_layer(
        os.path.join(SRC_DIR, "C02-14_GML.401d042c.zip"),
        "C02-14_GML/C02-14-g_PortAndHarbor.shp",
        "C02-14_GML/C02-14-g_PortAndHarbor.dbf",
    )
    ports = []
    for idx, (row, pt) in enumerate(zip(records, points)):
        if pt is None:
            continue
        admin_code = row.get("C02_003", "")
        type_code = row.get("C02_002", "")
        pref_code = pref_code_of(admin_code)
        item = {
            "i": f"H{idx:05d}",
            "k": "h",
            "n": row.get("C02_005", ""),
            "p": PREF_NAME.get(pref_code, ""),
            "pc": pref_code,
            "r": REGION_OF_PREF.get(pref_code, "kanto"),
            "t": HARBOR_TYPE.get(type_code, "港湾"),
            "tc": int(type_code) if type_code.isdigit() else 0,
            "a": row.get("C02_007", ""),
            "la": pt[0],
            "lo": pt[1],
            "code": row.get("C02_004", ""),
        }
        ol = row.get("C02_011", "")
        ml = row.get("C02_012", "")
        if ol.isdigit():
            item["ol"] = int(ol)
        if ml.isdigit():
            item["ml"] = int(ml)
        if row.get("C02_013", "").lower() == "true":
            item["fy"] = 1
        ports.append(item)
    return ports


def main() -> None:
    fishing = build_fishing_ports()
    harbors = build_harbors()
    all_ports = fishing + harbors
    all_ports.sort(key=lambda x: (x["pc"], x["k"], x["n"]))

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {
            "name": "国土数値情報 (国土交通省)",
            "fishingPort": "C09-06 漁港 (2011年)",
            "portAndHarbor": "C02-14 港湾 (2023年)",
            "license": "国土数値情報ダウンロードサービス 利用約款",
        },
        "counts": {
            "fishing": len(fishing),
            "harbor": len(harbors),
            "total": len(all_ports),
        },
        "prefectures": [{"code": c, "name": n} for c, n in PREFECTURES],
        "ports": all_ports,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    size = os.path.getsize(OUT_PATH)
    print(f"wrote {OUT_PATH}  {size/1024:.0f} KB")
    print(f"fishing ports: {len(fishing)} / harbors: {len(harbors)} / total: {len(all_ports)}")


if __name__ == "__main__":
    main()
