"""suumo_tokyo23.csv → 東京23区の㎡あたり家賃を集計し、アプリ用 TS データを生成する。

パイプライン:
    suumo_scraper.py  ->  suumo_tokyo23.csv
    build_ward_rents.py  ->  ../src/lib/valuation/wardRents.ts

「家賃」「面積」「住所」列から、各行の 円/㎡/月 を求め、区ごとの中央値を出して
wardRents.ts の WARD_RENT_PER_SQM を実データで上書きする。

使い方:
    python build_ward_rents.py            # suumo_tokyo23.csv を読む
    python build_ward_rents.py path/to.csv
"""

import csv
import os
import re
import statistics
import sys

TOKYO_23 = [
    "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区",
    "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区",
    "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区",
]

OUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "src", "lib", "valuation", "wardRents.ts"
)


def parse_rent_yen(text):
    """'9.8万円' -> 98000。取れなければ None。"""
    if not isinstance(text, str):
        return None
    m = re.search(r"([\d.]+)\s*万円", text)
    if m:
        return float(m.group(1)) * 10000
    m = re.search(r"([\d,]+)\s*円", text)
    if m:
        return float(m.group(1).replace(",", ""))
    return None


def parse_area_sqm(text):
    """'25.5m2' -> 25.5。取れなければ None。"""
    if not isinstance(text, str):
        return None
    m = re.search(r"([\d.]+)", text)
    return float(m.group(1)) if m else None


def extract_ward(address):
    """住所から東京23区の区名を取り出す。"""
    if not isinstance(address, str):
        return None
    for ward in TOKYO_23:
        if ward in address:
            return ward
    return None


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "suumo_tokyo23.csv"

    # 区ごとに 円/㎡・月 のサンプルを集める
    by_ward = {}
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            rent = parse_rent_yen(row.get("家賃"))
            area = parse_area_sqm(row.get("面積"))
            ward = extract_ward(row.get("住所"))
            if rent is None or area is None or ward is None or area <= 0:
                continue
            by_ward.setdefault(ward, []).append(rent / area)

    # 区ごとの中央値（外れ値に強い）。23区の並び順を維持。1円未満は四捨五入。
    medians, counts = {}, {}
    for ward in TOKYO_23:
        samples = by_ward.get(ward)
        if samples:
            medians[ward] = int(round(statistics.median(samples)))
            counts[ward] = len(samples)

    if not medians:
        print("有効なデータが見つかりませんでした。CSV の列名・内容を確認してください。")
        return

    write_ts(medians, counts)
    print(f"生成完了: {OUT_PATH}")
    for ward in medians:
        print(f"  {ward}: {medians[ward]:,} 円/㎡・月  (n={counts[ward]})")


def write_ts(medians, counts):
    lines = [
        "// 東京23区 賃貸の㎡あたり家賃（円/㎡・月）",
        "//",
        "// このファイルは tools/build_ward_rents.py が SUUMO 取得データ",
        "// （suumo_tokyo23.csv）の区別中央値から自動生成する。手動編集は不要。",
        "// 査定アプリの賃料推定・投資利回り評価のベースデータとして用いる。",
        "",
        "export const WARD_RENT_PER_SQM: Record<string, number> = {",
    ]
    for ward in medians:
        lines.append(f"  {ward}: {int(medians[ward])}, // n={int(counts[ward])}")
    lines.append("};")
    lines.append("")
    lines.append("export const WARD_RENT_WARDS = Object.keys(WARD_RENT_PER_SQM);")
    lines.append("")
    lines.append("/** 23区平均の㎡賃料（未対応区のフォールバック） */")
    avg = int(round(sum(medians.values()) / len(medians)))
    lines.append(f"export const WARD_RENT_AVERAGE = {avg};")
    lines.append("")
    lines.append("/** 指定エリア・専有面積から想定月額家賃（円）を推定する */")
    lines.append("export function estimateMonthlyRent(ward: string, sqm: number): number {")
    lines.append("  const unit = WARD_RENT_PER_SQM[ward] ?? WARD_RENT_AVERAGE;")
    lines.append("  return Math.round(unit * sqm);")
    lines.append("}")
    lines.append("")
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
