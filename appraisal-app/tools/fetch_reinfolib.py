"""国土交通省「不動産情報ライブラリ」API から実成約データを取得する。

取得した取引価格情報から、
  (a) 取引事例比較法用の成約事例（comparables.ts の SAMPLE_COMPS 相当）
  (b) エリア別の㎡単価中央値（data.ts の CITY_LAND_PRICE / バックテストの較正用）
を生成する。

これにより査定エンジンを「概算サンプル」から「実取引データ」ベースに引き上げられる。

前提:
  - 不動産情報ライブラリの利用登録 → APIキー（サブスクリプションキー）を取得
    https://www.reinfolib.mlit.go.jp/  （無料）
  - 環境変数 REINFOLIB_API_KEY にキーを設定
  - pip install requests

使い方:
  export REINFOLIB_API_KEY=xxxxx
  python fetch_reinfolib.py --year 2024 --pref 08            # 茨城県の全市
  python fetch_reinfolib.py --year 2024 --pref 13 --city 13101

出力:
  - reinfolib_comps.json … 成約事例（生データ整形済み）
  - 標準出力に comparables.ts へ貼り付け可能な TransactionComp[] を表示
  - 標準出力にエリア別㎡単価中央値（CITY_LAND_PRICE 較正の目安）を表示

※ この環境はネットワークが制限されているため実行できない場合があります。
  ネットワーク可の環境（手元PC等）で実行してください。
"""

import argparse
import json
import os
import statistics
import sys

import requests

API_BASE = "https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001"

# 種別名（API）→ アプリの propertyType
TYPE_MAP = {
    "宅地(土地)": "land",
    "宅地(土地と建物)": "house",
    "中古マンション等": "apartment",
}


def fetch(year: int, pref: str, city: str | None, quarter: int | None):
    key = os.environ.get("REINFOLIB_API_KEY")
    if not key:
        sys.exit("環境変数 REINFOLIB_API_KEY が未設定です。")
    params = {"year": year, "area": pref}
    if city:
        params["city"] = city
    if quarter:
        params["quarter"] = quarter
    headers = {"Ocp-Apim-Subscription-Key": key}
    res = requests.get(API_BASE, params=params, headers=headers, timeout=60)
    res.raise_for_status()
    return res.json().get("data", [])


def to_comp(row: dict):
    ptype = TYPE_MAP.get(row.get("Type", ""))
    if not ptype:
        return None
    try:
        total = int(row.get("TradePrice", 0))
    except (TypeError, ValueError):
        return None
    if total <= 0:
        return None
    area = _num(row.get("Area"))
    building_area = _num(row.get("TotalFloorArea"))
    build_year = row.get("BuildingYear", "")  # 例 "2008年"
    age = 0
    if isinstance(build_year, str) and build_year.endswith("年") and build_year[:-1].isdigit():
        age = max(0, 2025 - int(build_year[:-1]))
    return {
        "city": row.get("Municipality", ""),
        "propertyType": ptype,
        "totalPrice": total,
        "landArea": area if ptype != "apartment" else 0,
        "buildingArea": building_area if ptype != "land" else 0,
        "buildAge": age,
        "walkMinutes": _num(row.get("TimeToNearestStation")),
        "tradeYear": int(str(row.get("Period", "0"))[:4] or 0),
    }


def _num(v):
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--pref", required=True, help="都道府県コード（例: 茨城08 / 栃木09 / 東京13 / 神奈川14 / 埼玉11 / 千葉12）")
    ap.add_argument("--city", default=None, help="市区町村コード（任意）")
    ap.add_argument("--quarter", type=int, default=None)
    args = ap.parse_args()

    rows = fetch(args.year, args.pref, args.city, args.quarter)
    comps = [c for c in (to_comp(r) for r in rows) if c]
    json.dump(comps, open("reinfolib_comps.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"取得: {len(rows)}件 / 整形後事例: {len(comps)}件 -> reinfolib_comps.json\n")

    # (a) comparables.ts 貼り付け用
    print("// ↓ comparables.ts の SAMPLE_COMPS に貼り付け")
    for c in comps[:200]:
        print(
            f'  {{ city: "{c["city"]}", propertyType: "{c["propertyType"]}", '
            f'totalPrice: {int(c["totalPrice"])}, landArea: {c["landArea"]:.0f}, '
            f'buildingArea: {c["buildingArea"]:.0f}, buildAge: {c["buildAge"]}, '
            f'walkMinutes: {c["walkMinutes"]:.0f}, tradeYear: {c["tradeYear"]} }},'
        )

    # (b) エリア別㎡単価中央値（CITY_LAND_PRICE 較正の目安）
    by_city = {}
    for c in comps:
        size = c["buildingArea"] if c["propertyType"] == "apartment" else c["landArea"]
        if size > 0:
            by_city.setdefault(c["city"], []).append(c["totalPrice"] / size)
    print("\n// エリア別 ㎡単価中央値（円/㎡）— CITY_LAND_PRICE 較正の参考")
    for city, units in sorted(by_city.items()):
        print(f"//   {city}: {int(round(statistics.median(units))):,} 円/㎡ (n={len(units)})")


if __name__ == "__main__":
    main()
