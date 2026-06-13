# financial-literacy-line-bot — 金融リテラシーボット (LifePartner FP)

「金融リテラシー向上プログラム | LifePartner FP」向けの **ルールベース FAQ LINE ボット**です。
お金の基礎知識（家計・保険・投資・NISA/iDeCo・税金・年金・住宅ローン・相続・詐欺対策）を、LINE 上でやさしく解説します。
（AI/LLM は使わず、固定のルールベース応答のみ。`japan-mgmt-line-bot` / `Chat-Bridge` と同じ作り：Express + `/webhook` + `X-Line-Signature` 検証 + reply API）

内容は `fp` リポジトリ「金融リテラシー向上プログラム」の知識領域を踏襲しています。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `server.js` | Express アプリ。`/webhook` で LINE イベントを受信し、署名検証 → 応答を返す |
| `faq.js` | **唯一の情報源**。FAQ ルール・プログラム情報・あいさつ/フォールバック/免責文をここに集約 |
| `.env.example` | 必要な環境変数のテンプレート |
| `package.json` | ES Modules。依存は `express` のみ（Node 18+ の global `fetch` を使用） |

応答内容を変えたいときは **`faq.js` だけ** を編集します。`〔要確認〕` は連絡先など仮の文言なので実値に差し替えてください。

## セットアップ

```bash
cd financial-literacy-line-bot
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

```bash
npm start
curl 'http://localhost:3000/dev/simulate?text=NISA'
curl 'http://localhost:3000/dev/simulate?text=家計管理'
curl 'http://localhost:3000/health'
```

`/dev/simulate` は `NODE_ENV=production` のときは無効になります。

## LINE Developers での設定

1. [LINE Developers コンソール](https://developers.line.biz/console/) で **Messaging API チャネル**を作成
2. 「チャネルシークレット」と「長期チャネルアクセストークン」を発行し、`.env` に設定
3. サーバーを HTTPS で公開（本番は任意のホスティング、ローカル検証は `ngrok http 3000` などでトンネル）
4. 「Messaging API設定」の **Webhook URL** に `https://<公開ドメイン>/webhook` を設定し、**Webhookの利用をオン**
5. 「Verify」で疎通確認（200 が返ればOK）。あいさつ/応答メッセージ（自動応答）はオフ推奨

## 応答の仕組み

- ユーザーのテキストを正規化し、`faq.js` の `FAQ` ルールを上から評価。`keywords` のいずれかを含めばその `answer` を返す
- どれにもマッチしなければ `fallbackMessage()` を返す
- 友だち追加（`follow`）時は `greetingMessage()`（免責つき）を返す
- すべての応答にクイックリプライ（`MENU_LABELS`）を付け、タップで主要トピックを選べる

## カスタマイズ

- FAQ 追加：`faq.js` の `FAQ` 配列に `{ id, label, keywords, answer }` を追加
- メニュー変更：`MENU_LABELS` を編集
- プログラム情報：`PROGRAM`（電話・受付時間・サイト・免責文）を編集

## 注意（重要）

- 本ボットは **一般的な金融教育情報**を提供するもので、個別の投資勧誘・助言や断定的判断の提供ではありません（`PROGRAM.disclaimer`）。
- NISA/iDeCo・税制などの数値は改正され得ます。具体的な金額・要件は金融庁・国税庁・日本年金機構などの公式情報を確認のうえ、`faq.js` を更新してください。
- `.env` はコミットしないでください（`.gitignore` 済み）。
