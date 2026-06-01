# n8n Workflows

このディレクトリには n8n にインポート可能なワークフロー JSON が格納されています。

## ワークフロー一覧

| ファイル | 用途 |
| --- | --- |
| `telegram-to-sheets-slack.json` | Telegram → Sheets + Slack 通知（既存） |
| `slack-modal-trigger-daily.json` | `/daily` → 日報モーダル表示 |
| `slack-modal-trigger-apo.json` | `/apo` → アポ追加/キャンセル モーダル表示 |
| `slack-modal-trigger-feedback.json` | `/feedback` → 顧客フィードバック モーダル表示 |
| `slack-modal-submit-handler.json` | 3 つのモーダル送信を一括処理（Sheets append + Slack 通知） |

---

# Slack Modal Workflows（業務フォーム連携）

`/daily` `/apo` `/feedback` の 3 スラッシュコマンドからモーダルを開き、送信内容を Google Sheets に蓄積 + Slack チャンネルに通知。

## フロー全体図

```
[Slack User]
    │ /daily, /apo, /feedback
    ▼
[Trigger Workflow]                          ┌──────────────┐
  Webhook → Extract → views.open → Respond  │ Slack Modal  │
                                            └──────┬───────┘
                                                   │ submit
                                                   ▼
                              [Submit Handler Workflow]
                                Webhook → Parse (callback_id 分岐)
                                       ↓
                                  Switch
                                  ├─ daily_report      → Sheets: daily_reports
                                  ├─ apo_action        → Sheets: apo_log
                                  └─ customer_feedback → Sheets: feedback_log
                                       ↓
                                  Slack Channel Notify
```

## セットアップ手順

### 1. n8n でワークフローをインポート

4 つの JSON を全てインポートし、各 `REPLACE_WITH_*` を実値に置換:
- `REPLACE_WITH_SLACK_BOT_TOKEN` → Slack Bot User OAuth Token (`xoxb-...`)
- `REPLACE_WITH_SLACK_CREDENTIAL_ID` → n8n Slack credential
- `REPLACE_WITH_SLACK_CHANNEL_ID` → 通知先チャンネル ID
- `REPLACE_WITH_GOOGLE_SHEET_ID` → スプレッドシート ID
- `REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID` → n8n Google Sheets credential

### 2. Slack App 設定

**Slash Commands**（3 件登録）:
| Command | Request URL |
| --- | --- |
| `/daily` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-daily` |
| `/apo` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-apo` |
| `/feedback` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-feedback` |

**Interactivity & Shortcuts**（Request URL）:
```
https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-submit
```

**Bot Token Scopes**:
- `commands` — スラッシュコマンド受信
- `chat:write` — チャンネル通知
- `users:read` — ユーザー情報取得（オプション）

### 3. Google Sheets 準備

スプレッドシートに 3 つのシートを作成:

**`daily_reports`**
```
timestamp | callback_id | staff_slack_id | staff_slack_name | channel_id |
report_date | call_count | apo_count | meeting_count | contract_count |
highlights | tomorrow_plan | blockers
```

**`apo_log`**
```
timestamp | callback_id | staff_slack_id | staff_slack_name | channel_id |
action_type | customer_code | deal_code | apo_datetime | reason
```

**`feedback_log`**
```
timestamp | callback_id | staff_slack_id | staff_slack_name | channel_id |
deal_code | customer_code | feedback_type | rating | content | action_needed
```

各ワークフローの Google Sheets ノードは `autoMapInputData` モードのため、
**ヘッダー名が一致している必要があります**。

## 機微情報の扱い

- 顧客実名は入力欄に含まず、**案件 ID + 顧客匿名コード（CUST-A 形式）** のみ記録
- Sheets の閲覧権限は **営業 + 経営層のみ**
- Slack 通知は専用プライベートチャンネル推奨

---

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
