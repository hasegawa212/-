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
| （不一致） | 案内文＋クイックリプライ |

内容を変えたいときは基本 **`faq.js` だけ** 編集すればOKです。

---

## リッチメニューの登録

1. `assets/richmenu.svg` を **2500×1686 の PNG** に変換して `assets/richmenu.png` を用意
   ```bash
   # 例1) rsvg-convert
   rsvg-convert -w 2500 -h 1686 assets/richmenu.svg -o assets/richmenu.png
   # 例2) Chrome ヘッドレス
   chrome --headless --window-size=2500,1686 --screenshot=assets/richmenu.png assets/richmenu.svg
   ```
2. 登録（`.env` の `LINE_CHANNEL_ACCESS_TOKEN` を使用し、全ユーザーのデフォルトに設定）
   ```bash
   npm run setup:richmenu
   ```

6セルは次のメッセージを送信し、そのまま FAQ に着地します：
無料相談 / 査定 / 購入 / リフォーム / 太陽光 / アクセス。

---

## LINE Developers 側の設定

1. [LINE Developers](https://developers.line.biz/) で **Messaging API チャネル**を作成
2. **チャネルシークレット** と **チャネルアクセストークン（長期）** を発行 → `.env` に設定
3. **Webhook URL** に `https://<公開ホスト>/webhook` を設定し、Webhook を「オン」
4. 応答設定で「あいさつメッセージ」「応答メッセージ」はオフ、「Webhook」をオンに
5. 必要な権限：メッセージ送信（reply）／リッチメニュー

### デプロイ

`express` のみの単純な Node アプリなので、Render / Railway / Fly.io などにそのまま載せられます
（`npm start`、ヘルスチェック `GET /health`）。`PORT` は環境変数で上書き可能。

---

## 注意

- `.env` は Git 管理外（`.gitignore`）。トークン類は絶対にコミットしないでください。
- `faq.js` の `〔要確認〕`（特に**代表電話番号**）は、公式の最新情報に差し替えてください。
- 本ボットは AI を使わないルールベースです。想定外の質問には案内文＋メニューでフォローします。
