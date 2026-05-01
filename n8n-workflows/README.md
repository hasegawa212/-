# n8n Workflow: Telegram → Google Sheets + Slack

Telegramに届いたメッセージを Google Sheets に記録し、Slack にも通知するn8nワークフローです。

## フロー図

```
Telegram Trigger → Normalize Message → Has Text?
                                          ├─ true → Append to Sheets → Telegram Ack
                                          │        └→ Notify Slack
                                          └─ false → (停止)
```

## 事前準備

### 1. Telegram Bot

1. [@BotFather](https://t.me/BotFather) で `/newbot` を実行しボットを作成
2. 発行された **Bot Token** を控える
3. n8nの **Credentials → New → Telegram API** に登録

### 2. Google Sheets

1. 新規スプレッドシートを作成 (例: `telegram-log`)
2. 1枚目のシート名を `Messages` にし、1行目に以下のヘッダーを追加:
   ```
   timestamp | chat_id | chat_title | user_id | username | text | message_id
   ```
3. URLから **Sheet ID** を取得 (`.../spreadsheets/d/<SHEET_ID>/edit`)
4. n8nの **Credentials → New → Google Sheets OAuth2 API** に登録

### 3. Slack

1. Slackアプリを作成 or 既存のものを使用 (`chat:write` スコープ必須)
2. 通知先チャンネルにアプリを招待
3. **Channel ID** を控える (チャンネル名を右クリック → リンクをコピー、末尾のID)
4. n8nの **Credentials → New → Slack OAuth2 API** に登録

## インポート手順

1. n8nを開く → **Workflows → Import from File**
2. `telegram-to-sheets-slack.json` を選択
3. 各ノードの `REPLACE_WITH_*` を自分の値に置き換え:
   - `REPLACE_WITH_TELEGRAM_CREDENTIAL_ID` → Telegram認証情報
   - `REPLACE_WITH_GOOGLE_SHEET_ID` → スプレッドシートID
   - `REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID` → Google Sheets認証情報
   - `REPLACE_WITH_SLACK_CHANNEL_ID` → Slackチャンネル ID
   - `REPLACE_WITH_SLACK_CREDENTIAL_ID` → Slack認証情報
4. 右上の **Active** トグルをONにして有効化

## ノード詳細

| ノード | 役割 |
| --- | --- |
| Telegram Trigger | `message` イベントをWebhookで受信 |
| Normalize Message | 必要フィールドだけに整形 (timestamp, chat, user, text…) |
| Has Text? | テキストが空のメッセージ (スタンプ等) を除外 |
| Append to Google Sheets | `Messages` シートに1行追加 |
| Notify Slack | 整形したメッセージを指定チャンネルに投稿 |
| Telegram Ack | 送信者に「受信しました ✅」と返信 |

## テスト方法

1. ワークフローを **Active** にする
2. Telegramでボットにテキストを送る
3. Google Sheets に行が追加されること / Slackに通知が来ること / Telegramで「受信しました ✅」が返ってくることを確認

## カスタマイズ

- **画像/ファイル対応**: `Has Text?` を条件分岐にして `photo` / `document` を Google Drive へアップロードするノードを追加
- **コマンド処理**: `Normalize Message` の後に `Switch` ノードを置き `/start` 等を振り分け
- **要約**: `Append to Google Sheets` の前に OpenAI/Claude ノードを挟んで要約を保存
