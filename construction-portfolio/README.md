# 施工事例集パンフレット（construction-portfolio）

株式会社 Martial Arts（不動産・建設）の **高級志向の施工事例パンフレット「WORKS」**。
実際の施工写真を使い、A4・全8ページのプレミアムなブローシュア（ダーク×ゴールド）として
印刷／PDF出力できます。`construction-book`（施工記録ブック作成ツール）が顧客への記録用なのに対し、
こちらは **営業・ブランディング用の見せるパンフレット**です。

`echo-interview-console` / `construction-book` と同じく **ゼロ依存・単一HTML**（ビルド不要）。
`arr-gallery-pamphlet` と同様に写真は `img/` に置いて相対参照します。

## 構成（A4・8ページ）

1. 表紙 — 外観写真フルブリード ＋ 大きく「WORKS / 施工事例集」
2. 理念（Philosophy）— 「自社施工の誇りと共に。」
3. 外観（Exterior）— 黒の佇まいをフルページで
4. 住まい（Living）— LDK・内装・建具
5. キッチン（Kitchen）— 2タイプ＋設備
6. 外構・設備（Approach & Facilities）— 玄関アプローチ・エコキュート
7. 施工品質（Craftsmanship）— 基礎・上棟・断熱など“見えない品質”を4点グリッドで
8. 会社情報（Contact）— 「Your Home, Our Pride. / 自社施工の誇りと共に。」

## 使い方

ビルド不要。静的に配信するだけです。

```bash
cd construction-portfolio
python3 -m http.server 5182   # → http://localhost:5182
```

`index.html` をブラウザで直接開いても動作します（写真は `img/` フォルダと同じ場所に置いてください）。

### 編集（ブラウザ上で完結）

- 上部ツールバーの案内どおり、**文字をクリックすると直接書き換え**できます（会社名・TEL・URL・キャッチコピー・キャプションなど）。
- **写真をクリックすると差し替え**できます（選択した画像は最大1600pxにcanvas圧縮して埋め込み）。
- 編集内容は **localStorage に自動保存**（`martialarts_portfolio_v1`）。「初期化」ボタンで初期状態へ戻せます。
- 仕上がったら右上 **「印刷 / PDF」→「PDFとして保存」** で配布用PDFを出力。

## カスタマイズ

- 文章・見出し・キャプションは各要素の `contenteditable` をブラウザ上で編集（恒久的に変えたい場合は `index.html` を直接編集）。
- 写真は `img/p01.jpg` 〜（外観・LDK・キッチン・外構・基礎・上棟・断熱など）。差し替えはファイルを置き換えるか、ブラウザ上のクリック差し替えを利用。
- 配色・タイポグラフィは `:root` 変数とページ別CSS（ゴールド `--gold`、A4 = 794×1123px @96dpi、`@media print`）。

ビルド・テスト・Lint はありません（単一HTML）。
