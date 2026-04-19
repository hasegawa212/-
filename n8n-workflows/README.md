# n8n Workflows

Telegram / Google Sheets / Slack を組み合わせた業務自動化ワークフロー集です。

| ファイル | 用途 |
| --- | --- |
| `telegram-to-sheets-slack.json` | Telegram受信 → ログをSheetsに追記 + Slack通知 |
| `telegram-call-log-to-sheet.json` | Telegramで「No. 結果」を送ると、テレアポ管理シートの該当行を自動更新。アポ獲得時はSlackに通知 |

---

## ワークフロー1: Telegram → Google Sheets + Slack

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

---

## ワークフロー2: Telegram → テレアポ管理シート 自動更新

担当者がTelegramに「`<No.> <結果>`」と送るだけで、`テレアポ管理シート` の該当行の **架電日N / 架電結果N / 架電ステータス** が自動更新されるワークフロー。アポ獲得時は Slack にも通知します。

### フロー図

```
Telegram Trigger → Parse Command → Parse OK?
                                      ├─ NG → Telegram: Error
                                      └─ OK → Lookup Row by No. → Pick Empty Slot → Slot OK?
                                                                                        ├─ NG → Telegram: Error
                                                                                        └─ OK → Update Sheet Row → Is Appointment?
                                                                                                                       ├─ Yes → Slack: Appointment + Telegram: Confirm
                                                                                                                       └─ No  → Telegram: Confirm
```

### 入力フォーマット

担当者がボットに送る文言:

```
3 アポ獲得         ← No.3 にアポ獲得を記録
12 不在            ← No.12 に不在を記録
/log 7 再架電      ← /log プレフィックスもOK
5:番号違い         ← コロン区切りもOK
```

結果キーワード → 架電ステータスの対応:

| キーワード | 設定される 架電ステータス | アポ通知 |
| --- | --- | --- |
| アポ獲得 / 獲得 / 成約 | アポ獲得 | ✅ Slack通知 |
| アポ | アポ予定 | — |
| 不在 / 留守 | 次回架電予定 | — |
| 拒否 / 断り / NG | 対応不可 | — |
| 再架電 / 折り返し | 次回架電予定 | — |
| 番号違い | 番号誤り | — |
| その他 | 架電済み | — |

### 動作

1. `Parse Command` がメッセージを `No.` と `結果` に分解
2. `Lookup Row by No.` で該当行をシートから取得
3. `Pick Empty Slot` が `架電日1/2/3` のうち空いている枠を判定
4. `Update Sheet Row` で `架電日N` / `架電結果N` / `架電ステータス` を更新 (結果欄には担当者名も付加)
5. 「アポ獲得」系のキーワードならSlackチャンネルにお祝い通知
6. 担当者にTelegramで「✅ 記録しました」と返信

### 事前準備

ワークフロー1と同じ Telegram / Google Sheets / Slack の認証情報を使い回せます。シートは既存の `テレアポ管理シート` (列: `No.`, `架電ステータス`, `架電日1〜3`, `架電結果1〜3` など) を Google Sheets にインポートしてください。

### インポート手順

1. n8nを開く → **Workflows → Import from File**
2. `telegram-call-log-to-sheet.json` を選択
3. `REPLACE_WITH_*` を置換 (Telegram / Google Sheets / Slack の認証情報ID + シートID + チャンネルID)
4. シート名 (`テレアポ管理シート`) が実際のシートタブ名と一致しているか確認
5. **Active** をONにする

### テスト

1. ボットに `1 アポ獲得` と送信
2. シートの No.1 の `架電日1` に今日の日付、`架電結果1` に「アポ獲得 (担当者名)」、`架電ステータス` に「アポ獲得」が入る
3. Slackに :tada: 通知が届く
4. Telegramで「✅ 記録しました」と返信される
