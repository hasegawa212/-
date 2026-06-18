# japan-mgmt-line-bot — ジャパンマネジメント FAQ LINE ボット

株式会社ジャパンマネジメント（http://japan-mgmt.co.jp/ ）向けの **ルールベース FAQ LINE ボット**です。
LINE Messaging API の webhook を Node + Express で受け、`faq.js` のキーワードルールに従って自動応答します。
（AI/LLM は使わず、固定のルールベース応答のみ。`Chat-Bridge` の LINE webhook と同じ作り：Express + `/webhook` + `X-Line-Signature` 検証 + reply API）

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `server.js` | Express アプリ。`/webhook` で LINE イベントを受信し、署名検証 → 応答を返す |
| `faq.js` | **唯一の情報源**。FAQ ルール・会社情報・あいさつ/フォールバック文をここに集約 |
| `.env.example` | 必要な環境変数のテンプレート |
| `package.json` | ES Modules。依存は `express` のみ（Node 18+ の global `fetch` を使用） |

応答内容を変えたいときは **`faq.js` だけ** を編集します。`〔要確認〕` が付いた箇所は仮の文言なので、実際の会社情報（手数料率・対応エリア・連絡先など）に差し替えてください。

## セットアップ

```bash
cd japan-mgmt-line-bot
cp .env.example .env      # LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN を設定
npm install
npm start                 # http://localhost:3000
# 開発（自動リロード）: npm run dev
```

### 環境変数

- `LINE_CHANNEL_SECRET` … LINE Developers > Messaging API チャネル >「チャネル基本設定」のチャネルシークレット（署名検証に使用）
- `LINE_CHANNEL_ACCESS_TOKEN` … 「Messaging API設定」の長期チャネルアクセストークン（返信送信に使用）
- `PORT` … 任意（既定 3000）

> 未設定でもサーバーは起動します。`LINE_CHANNEL_SECRET` が無いときは署名検証をスキップ（開発時のみ）、`LINE_CHANNEL_ACCESS_TOKEN` が無いときは送信せず応答内容をログ出力（dry-run）します。

## ローカルでの動作確認（LINE なし）

LINE に接続しなくても、応答ロジックだけを確認できます。

```bash
npm start
curl 'http://localhost:3000/dev/simulate?text=手数料'
curl 'http://localhost:3000/dev/simulate?text=必要書類'
curl 'http://localhost:3000/health'
```

`/dev/simulate` は `NODE_ENV=production` のときは無効になります。

## LINE Developers での設定

1. [LINE Developers コンソール](https://developers.line.biz/console/) で **Messaging API チャネル**を作成
2. 「チャネルシークレット」と「長期チャネルアクセストークン」を発行し、`.env` に設定
3. サーバーを HTTPS で公開（本番は任意のホスティング、ローカル検証は `ngrok http 3000` などでトンネル）
4. 「Messaging API設定」の **Webhook URL** に `https://<公開ドメイン>/webhook` を設定し、**Webhookの利用をオン**
5. 「Verify」で疎通確認（200 が返ればOK）。あいさつメッセージ/応答メッセージ（自動応答）はオフ推奨（このボットが返信を制御するため）

## 応答の仕組み

- ユーザーのテキストを正規化し、`faq.js` の `FAQ` ルールを上から評価。`keywords` のいずれかを含めばその `answer` を返す
- どれにもマッチしなければ `fallbackMessage()` を返す
- 友だち追加（`follow`）時は `greetingMessage()` を返す
- すべての応答にクイックリプライ（`MENU_LABELS`）を付け、タップで主要トピックを選べる

## カスタマイズ

- FAQ 追加：`faq.js` の `FAQ` 配列に `{ id, label, keywords, answer }` を追加（具体的な項目ほど上に置くとマッチ精度が上がる）
- メニュー変更：`MENU_LABELS` を編集
- 会社情報：`COMPANY`（電話・営業時間・サイト）を編集

## 注意

- 本ボットはルールベースのため、想定外の質問には `fallbackMessage()` で有人対応（電話/フォーム）へ誘導します
- `.env` はコミットしないでください（`.gitignore` 済み）
