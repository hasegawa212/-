# martialarts-line-bot — 株式会社 Martial Arts ビジネスライン（LINE公式アカウント）

[株式会社 Martial Arts](https://martialarts.co.jp/)（不動産・建設。買取／販売／建築・リフォーム／太陽光／設備工事／保険代理）の
**ビジネスライン**です。公式サイトのブランド（**ゴールド × 白基調の清潔感**）を LINE のトーク上で再現し、
**「どんな人でも最強に便利」** を目標に、次の3つを備えています。

1. **プロデザインの Flex メッセージ** — 白基調にゴールドを上品なアクセントとした、清潔感のあるカード（`flex.js`）
2. **リッチメニュー** — トーク下部に常時表示される6分割メニュー。文字入力なしでも主要導線へ届く（`richmenu.js` / `assets/richmenu.svg`）
3. **ルールベース FAQ** — キーワードの部分一致で自動応答（AIなし・`faq.js`）

構成は `japan-mgmt-line-bot` / `financial-literacy-line-bot` と同じ
「Express + `/webhook` + `X-Line-Signature`（HMAC-SHA256）検証 + reply API」。依存は `express` のみ。

---

## デザインをすぐ見る（LINE不要）

ブラウザで **`preview.html`** を開くと、実機に近いトーク画面のモックが見られます
（あいさつカード・サービスカルーセル・連絡先カード・クイックリプライ・リッチメニュー）。

```
open preview.html        # またはブラウザにドラッグ＆ドロップ
```

このプレビューは `flex.js` が送信する JSON を忠実に HTML 再現したものです。

---

## ローカルで動かす

```bash
cd martialarts-line-bot
cp .env.example .env       # LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN を設定
npm install
npm run dev                # node --watch。既定 http://localhost:3000
```

### LINEなしで応答を確認

```bash
curl -G 'http://localhost:3000/dev/simulate' --data-urlencode 'text=査定'
curl     'http://localhost:3000/dev/greeting'     # 友だち追加時のあいさつ
curl     'http://localhost:3000/health'
```

`/dev/*` は `NODE_ENV=production` では無効です。

---

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `faq.js` | **唯一の情報源**。会社情報（`COMPANY`）／6事業（`SERVICES`）／FAQルール（`FAQ`）／メニュー（`MENU`）とマッチング関数 |
| `flex.js` | **デザイン**。清潔感のある Flex カード（あいさつ・サービスカルーセル・詳細・CTA・連絡先・アクセス） |
| `server.js` | Webhook 本体。署名検証 → FAQ判定 → Flex/テキスト返信。`/dev/simulate`・`/health` |
| `richmenu.js` | リッチメニュー定義（6分割）と登録関数 `setupRichMenu()` |
| `setup-richmenu.js` | リッチメニューを LINE に登録する CLI |
| `assets/richmenu.svg` | リッチメニューのデザイン（2500×1686）。PNG化して使用 |
| `preview.html` | デザインのブラウザプレビュー（LINE不要） |

### 応答の仕組み（キーワード → 返信）

`faq.js` の `FAQ` を上から評価し、最初にマッチしたルールを返します。

| 入力の例 | 返信 |
| --- | --- |
| `サービス一覧` / `事業` | サービスカルーセル（6事業） |
| `査定` / `売却` / `相続` | 不動産買取・売却の詳細カード |
| `購入` / `土地` / `住宅ローン` | 不動産販売・購入の詳細カード |
| `リフォーム` / `新築` / `リノベ` | 建築・リフォームの詳細カード |
| `太陽光` / `蓄電` | 太陽光発電の詳細カード |
| `設備` / `エアコン` / `給湯器` | 設備・サービス工事の詳細カード |
| `保険` / `火災保険` | 保険（代理店）の詳細カード |
| `無料相談` / `見積` | 無料相談・査定 CTA カード |
| `アクセス` / `場所` | アクセスカード（地図ボタン付き） |
| `営業時間` / `電話` | 連絡先カード（電話・地図・サイト） |
| `専門知識` / `用語` | 専門知識メニュー（8テーマをタップして学べる Flex） |
| `豆知識` / `雑学` | 不動産トリビアをランダム表示（`もう1つみる` で連続表示） |
| （不一致） | 案内文＋クイックリプライ |

内容を変えたいときは基本 **`faq.js` だけ** 編集すればOKです。

### 不動産の専門知識（プロの知恵袋）

顧客からよく聞かれる不動産の実務知識を Q&A 化しています（`faq.js` の `KNOWLEDGE`）。
キーワードを送るとその場で解説が返ります。

| キーワード | 内容 |
| --- | --- |
| `仲介手数料` | 宅建業法の上限（速算式）・買取なら無料 |
| `住宅ローン控除` | 控除率0.7%・期間・省エネ要件 |
| `売却の流れ` | 査定→契約→決済までの5ステップ・必要書類 |
| `査定の種類` | 机上査定 / 訪問査定の違い |
| `建ぺい率` / `容積率` | 建てられる家の大きさの基本 |
| `再建築不可` | 接道義務・注意点 |
| `契約不適合` | 旧・瑕疵担保責任（2020年民法改正） |
| `税金` | 取得・保有・売却時の税金と特例 |
| `相続登記` | 2024年4月の義務化 |
| `売り先行` / `買い先行` | 住み替えの段取り |
| `売電` / `FIT` | 太陽光の売電・自家消費 |

> 税・法・制度の数字は年度で変わるため、`〔要確認〕` を付けた箇所は
> 国税庁・法務局・自治体等の一次情報で確認してください（本ボットは一般的な情報提供であり、個別の税務・法務助言ではありません）。

**豆知識**（`TIPS`）は12本の不動産トリビアをランダム表示します。追加・編集も `faq.js` だけでOK。

---

## リッチメニューの登録

**書き出し済みの `assets/richmenu.png`（2500×1686）を同梱済み**なので、変換不要でそのまま登録できます。

```bash
npm run setup:richmenu     # .env の LINE_CHANNEL_ACCESS_TOKEN を使い、全ユーザーのデフォルトに設定
```

6セルは次のメッセージを送信し、そのまま FAQ に着地します：
無料相談 / 査定 / 購入 / リフォーム / 太陽光 / アクセス。

デザインを変えたい場合は `assets/richmenu.svg` を編集し、PNG に書き出してから再登録してください。
```bash
# 例) Chrome ヘッドレス（rsvg-convert / デザインツールでも可）
chrome --headless --hide-scrollbars --window-size=2500,1686 \
  --screenshot=assets/richmenu.png assets/richmenu.svg
```

---

## 本番で使う（公開までの4ステップ）

実際にお客様の LINE から使えるようにするまでの最短手順です。

### 1. LINE 公式アカウント / Messaging API を用意
1. [LINE Developers](https://developers.line.biz/) で **Messaging API チャネル**を作成（既存の公式アカウントとも連携可）
2. **チャネルシークレット** と **チャネルアクセストークン（長期）** を発行
3. LINE Official Account Manager の「応答設定」で、**「応答メッセージ」オフ／「Webhook」オン／「あいさつメッセージ」オフ**（あいさつは本ボットが送るため）

### 2. サーバーを公開（デプロイ）
このフォルダには **Render 用 Blueprint（`render.yaml`）を同梱**しています。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

- Render → **New + → Blueprint** → 本リポジトリを選択し、Blueprint に `martialarts-line-bot/render.yaml` を指定
- 取り込み後、**Environment** で `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` を入力（`NODE_ENV=production` は設定済み）
- `express` だけの単純な Node アプリなので、Railway / Fly.io / 自前サーバーでも `npm start`（ヘルスチェック `GET /health`、`PORT` は環境変数で自動）で動きます

### 3. Webhook を接続
- チャネルの **Webhook URL** に `https://<公開したホスト>/webhook` を設定 → 「検証」で 200 が返ればOK
- Webhook を「オン」に

### 4. リッチメニューを反映
- ローカルまたはサーバーで `.env` にトークンを設定し `npm run setup:richmenu` を実行（画像同梱済み・変換不要）
- これで全ユーザーのトーク下部に6分割メニューが表示されます

> 動作確認：友だち追加 → あいさつカードが届く／「査定」「豆知識」などを送ると各カードが返れば成功です。
> 公開前に `NODE_ENV` を外した状態で `GET /dev/simulate?text=査定` を使うと、ローカルで応答を目視確認できます。

---

## 注意

- `.env` は Git 管理外（`.gitignore`）。トークン類は絶対にコミットしないでください。
- `faq.js` の `〔要確認〕`（特に**代表電話番号**）は、公式の最新情報に差し替えてください。
- 本ボットは AI を使わないルールベースです。想定外の質問には案内文＋メニューでフォローします。
