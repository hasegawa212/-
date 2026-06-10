"""SUUMO（東京都23区・賃貸）一覧スクレイパー。

東京23区の賃貸物件一覧を全ページ巡回し、建物・部屋単位の情報を CSV に保存する。
パース方式は定番の cassetteitem 構造（td インデックス指定）に準拠。
出力 CSV は build_ward_rents.py で「区別の㎡あたり家賃」に集計し、
査定アプリ（appraisal-app）の wardRents.ts データに反映する。

使い方:
    pip install -r requirements.txt
    python suumo_scraper.py            # -> suumo_tokyo23.csv

注意:
    - DOM のクラス名は SUUMO 側の改修で変わることがある。動かない場合は
      実 HTML（print(soup.prettify()[:3000])）に合わせてセレクタを調整する。
    - 機械的取得は提供元の利用規約・robots.txt の範囲で行うこと。
      サーバー負荷軽減のため各ページ取得後に sleep を入れている。
"""

import time
import urllib.parse

import pandas as pd
import requests
from bs4 import BeautifulSoup
from retry import retry

# 複数ページの情報をまとめて取得
data_samples = []

# スクレイピングするページ数（物件0ページに達したら自動終了）
max_page = 2000

# アクセス駅は1〜3件で可変なので、列ズレ防止のため固定長に正規化する
MAX_STATIONS = 3

# 出力 CSV の列名
COLUMNS = [
    "カテゴリ",
    "建物名",
    "住所",
    "アクセス1",
    "アクセス2",
    "アクセス3",
    "築年数",
    "階建",
    "階",
    "家賃",
    "管理費",
    "敷金",
    "礼金",
    "間取り",
    "面積",
    "url",
]

# SUUMO を東京都23区のみ指定して検索して出力した画面の URL（ページ数フォーマットが必要）
url = (
    "https://suumo.jp/jj/chintai/ichiran/FR301FC001/?ar=030&bs=040&ta=13"
    "&sc=13101&sc=13102&sc=13103&sc=13104&sc=13105&sc=13113&sc=13106&sc=13107"
    "&sc=13108&sc=13118&sc=13121&sc=13122&sc=13123&sc=13109&sc=13110&sc=13111"
    "&sc=13112&sc=13114&sc=13115&sc=13120&sc=13116&sc=13117&sc=13119"
    "&cb=0.0&ct=9999999&mb=0&mt=9999999&et=9999999&cn=9999999"
    "&shkr1=03&shkr2=03&shkr3=03&shkr4=03&sngz=&po1=25&pc=50&page={}"
)


# リクエストがうまく行かないパターンを回避するためのやり直し
@retry(tries=3, delay=10, backoff=2)
def load_page(target_url):
    html = requests.get(target_url, timeout=30)
    html.raise_for_status()
    soup = BeautifulSoup(html.content, "html.parser")
    return soup


def fetch_all_pages():
    """フェーズ1: 全ページを取得して soup のリストを返す（1アクセスごとに1秒休憩）。

    取得（I/O）とパースを分離することで、保存済みの soup を使って
    再取得なしに何度でもパースし直せる。
    """
    soups = []
    for page in range(1, max_page + 1):
        try:
            soup = load_page(url.format(page))
        except Exception as e:  # noqa: BLE001 - 取得失敗ページはスキップして継続
            print(f"page {page}: 取得失敗のためスキップ ({e})")
            continue

        if not soup.find_all(class_="cassetteitem"):
            print(f"page {page}: 物件なし。最終ページと判断して終了。")
            break

        soups.append(soup)
        print(f"page {page} 取得完了")

        # 1アクセスごとに1秒休む（マナー・規約対策）
        time.sleep(1)
    return soups


def parse_page(soup):
    """フェーズ2: 1ページ分の cassetteitem を data_samples に追加する。"""
    mother = soup.find_all(class_="cassetteitem")

    for child in mother:
        # --- 建物情報 ---
        data_home = []
        # カテゴリ
        data_home.append(child.find(class_="ui-pct ui-pct--util1").text)
        # 建物名
        data_home.append(child.find(class_="cassetteitem_content-title").text)
        # 住所
        data_home.append(child.find(class_="cassetteitem_detail-col1").text)
        # 最寄り駅のアクセス（1〜3件 → MAX_STATIONS 件に正規化）
        col2 = child.find(class_="cassetteitem_detail-col2")
        stations = [g.text for g in col2.find_all(class_="cassetteitem_detail-text")]
        stations = (stations + [""] * MAX_STATIONS)[:MAX_STATIONS]
        data_home.extend(stations)
        # 築年数と階数
        col3 = child.find(class_="cassetteitem_detail-col3")
        for grandchild in col3.find_all("div"):
            data_home.append(grandchild.text)

        # --- 部屋情報（1建物に複数行）---
        rooms = child.find(class_="cassetteitem_other")
        for room in rooms.find_all(class_="js-cassette_link"):
            data_room = []
            for id_, grandchild in enumerate(room.find_all("td")):
                # 階
                if id_ == 2:
                    data_room.append(grandchild.text.strip())
                # 家賃と管理費
                elif id_ == 3:
                    data_room.append(
                        grandchild.find(
                            class_="cassetteitem_other-emphasis ui-text--bold"
                        ).text
                    )
                    data_room.append(
                        grandchild.find(
                            class_="cassetteitem_price cassetteitem_price--administration"
                        ).text
                    )
                # 敷金と礼金
                elif id_ == 4:
                    data_room.append(
                        grandchild.find(
                            class_="cassetteitem_price cassetteitem_price--deposit"
                        ).text
                    )
                    data_room.append(
                        grandchild.find(
                            class_="cassetteitem_price cassetteitem_price--gratuity"
                        ).text
                    )
                # 間取りと面積
                elif id_ == 5:
                    data_room.append(grandchild.find(class_="cassetteitem_madori").text)
                    data_room.append(grandchild.find(class_="cassetteitem_menseki").text)
                # url
                elif id_ == 8:
                    get_url = grandchild.find(
                        class_="js-cassette_link_href cassetteitem_other-linktext"
                    ).get("href")
                    data_room.append(urllib.parse.urljoin(url, get_url))

            # 物件情報と部屋情報をくっつける
            data_samples.append(data_home + data_room)


def main():
    start = time.time()

    # フェーズ1: 全ページを取得（1秒休憩しながら）
    soups = fetch_all_pages()
    print(f"取得完了: {len(soups)} ページ / 経過 {time.time() - start:.1f} 秒")

    # フェーズ2: 取得済みページを順にパースして building+room を結合保存
    for soup in soups:
        parse_page(soup)
    print(f"パース完了: {len(data_samples)} 件")

    df = pd.DataFrame(data_samples, columns=COLUMNS).drop_duplicates()
    df.to_csv("suumo_tokyo23.csv", index=False, encoding="utf-8-sig")
    print(f"保存完了: {len(df)} 件 -> suumo_tokyo23.csv")
    print(f"総経過時間: {time.time() - start:.1f} 秒")


if __name__ == "__main__":
    main()
