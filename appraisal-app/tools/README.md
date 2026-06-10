# tools — 実データ取り込みパイプライン

SUUMO（東京都23区・賃貸）の公開データを取得し、査定アプリの賃料データ
（`src/lib/valuation/wardRents.ts`）を **実測ベースに更新** するためのスクリプト群です。

```
suumo_scraper.py     →  suumo_tokyo23.csv         （取得：全ページ巡回）
build_ward_rents.py  →  ../src/lib/valuation/wardRents.ts （集計：区別㎡賃料の中央値）
```

## セットアップ

```bash
cd appraisal-app/tools
pip install -r requirements.txt
```

## 1. 取得：`suumo_scraper.py`

東京23区の賃貸一覧を全ページ巡回し、建物・部屋単位の情報を CSV に保存します。

```bash
python suumo_scraper.py        # -> suumo_tokyo23.csv
```

- 構成は2フェーズ：**①全ページを取得（1秒休憩しながら）→ ②取得済みページをパース**。
  取得とパースを分けているので、保存済みページを使った再パースで再取得を避けられます。
- 物件0件のページに達したら自動終了します（`max_page=2000` は上限）。
- DOM のクラス名は SUUMO 側の改修で変わることがあります。動かない場合は
  `print(soup.prettify()[:3000])` で実構造を確認してセレクタを調整してください。

## 2. 集計＆反映：`build_ward_rents.py`

CSV の「家賃」「面積」「住所」から各行の **円/㎡・月** を計算し、区ごとの中央値を
求めて `wardRents.ts` を自動生成（上書き）します。

```bash
python build_ward_rents.py     # suumo_tokyo23.csv を読む
```

生成される `WARD_RENT_PER_SQM` は、アプリ側で `estimateMonthlyRent(区, 専有面積)` から
想定家賃を求めるのに使われ、投資区分の利回り評価などのベースになります。

> `wardRents.ts` には現在 **公開相場ベースのシード（概算）値** が入っています。
> 上記スクリプトを実行すると実データで置き換わります。

## 注意（規約・マナー）

機械的取得は提供元（SUUMO / リクルート）の利用規約・`robots.txt` の範囲で行ってください。
スクリプトには負荷軽減のため1アクセスごとの `sleep` を入れています。商用・大量取得の場合は
特に規約の確認を推奨します。
