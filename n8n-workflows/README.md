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
| `invoice-receipt-pdf-merge.json` | Slack リアクション → 請求書PDF + 振込受付書を1つのPDFに結合 → Google Drive 格納 |

---

# 請求書 × 振込受付書 PDF 結合ワークフロー（`invoice-receipt-pdf-merge.json`）

経理スレッドで **請求書振込依頼の投稿（親メッセージに請求書PDF）** に対し、振込完了後に
**振込受付書（スクリーンショット/PDF）をスレッド返信** し、親メッセージに所定の絵文字リアクションを
付けると、請求書と受付書を **1つのPDFに自動結合 → 命名 → 梅本様共有フォルダ（Google Drive）へ格納**
します。税理士が「どの請求書に対する支払いか」を1ファイルで確認できる状態を、手作業ゼロで実現します。

## 運用イメージ

```
[請求書振込依頼を投稿（親メッセージに 請求書PDF を添付）]
        │
        ▼  …振込完了…
[CEO がそのスレッドに 振込受付書（スクショ/PDF）を返信]
        │
        ▼  親メッセージに :振込完了: リアクションを付ける（ワンクリック）
[n8n ワークフロー]
  Webhook(reaction_added) → スレッド取得 → 請求書/受付書を特定
        → CloudConvert(画像→PDF化 + 結合) → Google Drive へ格納
        → merge_log に記録 → スレッドに完了報告 + ✅ リアクション
```

- **トリガー**: 親メッセージへの特定絵文字リアクション（`REPLACE_WITH_TRIGGER_EMOJI`、例: `furikomi_done`）
- **結合エンジン**: CloudConvert（画像のPDF化と複数PDFの結合を1ジョブで実行）
- **保存先**: 梅本様共有フォルダ（Google Drive、親フォルダ `REPLACE_WITH_DRIVE_PARENT_FOLDER_ID`）配下の**請求分ごとの期間フォルダ**（例 `⭐️★2026.5.29請求分　有限会社川上産業`）へ自動振り分け（無ければ自動作成）
- **漏れ防止**: 完了後に親メッセージへ `:white_check_mark:` を自動付与＋`merge_log` シートに台帳記録
- **まとめ処理にも対応**: 週次/月次でまとめてリアクションを付けていけば、その分だけ順次処理されます

## フロー図（ノード）

```
Slack Events Webhook → Parse Slack Event ─┬→ Ack Slack 200 (即時応答)
                                          └→ Process reaction?
                                               └(対象)→ Get Thread Replies
                                                         → Build CloudConvert Job
                                                         → Files found?
                                                            ├(NG)→ Notify Missing Files
                                                            └(OK)→ CloudConvert: Create Job
                                                                   → CloudConvert: Wait
                                                                   → Get Export URL
                                                                   → Download Merged PDF
                                                                   → Find Period Folder
                                                                   → Period folder exists?
                                                                      ├(無)→ Create Period Folder ─┐
                                                                      └(有)──────────────────────┤
                                                                   → Resolve Folder Id ←──────────┘
                                                                   → Upload to Drive（期間フォルダへ）
                                                                   → Append merge_log
                                                                   → Notify Thread (done)
                                                                   → Add Done Reaction
```

## 事前準備

### 1. CloudConvert
1. [cloudconvert.com](https://cloudconvert.com/) でアカウント作成 → **API Key** を発行
2. n8n の **Credentials → New → Header Auth** を作成し、`Name = Authorization` / `Value = Bearer <CloudConvert API Key>` を登録（このワークフローでは `CloudConvert` という名前で参照）

> ⚠️ CloudConvert は外部サービスのため、結合のために**請求書PDFと受付書が一時的に CloudConvert へ送信**されます（書類取り扱いの観点で承認済みの方式）。社外秘運用が必要になった場合は、自前ホストの Stirling-PDF 等への差し替えも可能です。

### 2. Slack App
**Bot Token Scopes**（OAuth & Permissions）:
- `reactions:read` — リアクションイベント受信（必須）
- `channels:history` / `groups:history` — スレッド本文・添付ファイル取得（チャンネル種別に応じて）
- `files:read` — 添付ファイル（請求書/受付書）の取得
- `chat:write` — スレッドへの完了報告
- `reactions:write` — 完了の ✅ 付与

**Event Subscriptions**:
1. **Enable Events** を On
2. **Request URL** に `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-invoice-merge` を設定（保存時に URL 検証ハンドシェイクが走り、ワークフローが応答します）
3. **Subscribe to bot events** に `reaction_added` を追加 → **Reinstall to Workspace**

n8n の **Credentials → New → Header Auth** をもう1つ作成し、`Name = Authorization` / `Value = Bearer xoxb-...`（Bot User OAuth Token）を登録（このワークフローでは `Slack Bot Token` という名前で参照）。

### 3. Google Drive
- 梅本様共有フォルダ（**親フォルダ**）の **フォルダ ID** を控える（URL `.../folders/<FOLDER_ID>`）。この配下に請求分ごとの期間フォルダが作られます。
- n8n の **Credentials → New → Google Drive OAuth2 API** を登録（このワークフローでは `Google Drive` という名前で参照）
- ※ 共有ドライブ（Shared Drive）配下の場合もそのまま動作します（API 呼び出しに `supportsAllDrives` を付与済み）

### 4. Google Sheets（台帳 `merge_log`）
STEP 3 のスプレッドシートに `merge_log` シートを追加し、1行目に以下のヘッダーを作成:
```
timestamp | invoice_name | filename | folder | drive_link | channel | message_ts
```

## インポート手順

1. n8n → **Workflows → Import from File** → `invoice-receipt-pdf-merge.json`
2. 各 `REPLACE_WITH_*` を差し替え:
   | プレースホルダ | 入れる値 |
   | --- | --- |
   | `REPLACE_WITH_TRIGGER_EMOJI` | トリガーにする絵文字名（`:` なし。例 `furikomi_done`） |
   | `REPLACE_WITH_SLACK_HEADER_CREDENTIAL_ID` | Slack Bot Token の Header Auth credential |
   | `REPLACE_WITH_SLACK_BOT_TOKEN` | Bot User OAuth Token（`xoxb-...`）※「Build CloudConvert Job」ノードの Code 内。CloudConvert が Slack の非公開ファイルURLを取得するために使用 |
   | `REPLACE_WITH_CLOUDCONVERT_CREDENTIAL_ID` | CloudConvert の Header Auth credential |
   | `REPLACE_WITH_DRIVE_PARENT_FOLDER_ID` | 梅本様共有フォルダ（親）の Drive フォルダ ID。「Find Period Folder」と「Create Period Folder」の2ノードに記載（検索クエリと作成時の `parents`）。この配下に期間フォルダを作成・格納します |
   | `REPLACE_WITH_GOOGLE_DRIVE_CREDENTIAL_ID` | Google Drive OAuth2 credential（Find/Create/Upload の3ノード） |
   | `REPLACE_WITH_GOOGLE_SHEET_ID` | 台帳スプレッドシートの ID |
   | `REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID` | Google Sheets OAuth2 credential |
3. 右上の **Active** を ON

## ノード詳細

| ノード | 役割 |
| --- | --- |
| Slack Events Webhook | `reaction_added` イベント / URL 検証を受信 |
| Parse Slack Event | 検証ハンドシェイク応答・対象絵文字判定・親メッセージ ts 抽出 |
| Ack Slack 200 | Slack へ 3 秒以内に即時 200 応答（本処理は別ブランチで継続） |
| Process reaction? | 対象リアクションのみ後続へ |
| Get Thread Replies | `conversations.replies` でスレッド全体を取得 |
| Build CloudConvert Job | 親=請求書PDF / 返信=受付書 を特定し、命名 + CloudConvert ジョブ定義を生成 |
| Files found? | 請求書・受付書が揃っているか判定（欠けていれば差し戻し通知） |
| CloudConvert: Create Job / Wait | 画像のPDF化 + 結合ジョブを実行し完了を待機 |
| Get Export URL | 結合済みPDFのダウンロードURLを取得 |
| Find Period Folder | 親フォルダ配下に期間フォルダ（例 `⭐️★2026.5.29請求分　有限会社川上産業`）が存在するか Drive を検索 |
| Period folder exists? | 既存フォルダの有無で分岐 |
| Create Period Folder | 無ければ親フォルダ配下に期間フォルダを新規作成 |
| Resolve Folder Id | 既存/新規どちらでも格納先フォルダ ID を確定 |
| Download Merged PDF | 結合PDFをバイナリで取得 |
| Upload to Drive | 確定した期間フォルダへ格納 |
| Append merge_log | 台帳（請求書名・ファイル名・フォルダ・Driveリンク）に記録 |
| Notify Thread (done) / Add Done Reaction | スレッドに完了報告＋✅ で処理済みを可視化 |
| Notify Missing Files | 請求書/受付書が不足している場合にスレッドへ差し戻し |

## 運用上の注意

- **リアクションは「親メッセージ（請求書PDF投稿）」に付ける**こと。受付書は同じスレッドに返信しておく必要があります。
- 受付書が画像（スクショ）でも PDF でも、いずれも結合対象として処理します（画像は自動でPDF化）。
- **分割払い等で複数の受付書**がある場合も対応済みです。スレッド内の受付書（画像/PDF）を**全件、Slack投稿順（時系列＝アップロード日時 `created` の昇順）で**請求書の後ろに結合します（請求書 → 受付書1 → 受付書2 …）。1スレッドに受付書を複数返信しておけば、まとめて1つのPDFになります。
- 重複処理防止のため、処理済みには `:white_check_mark:` が付きます。トリガー絵文字とは別の絵文字にしてあるためループしません。

## 期間フォルダ名の決まり方（Slack 投稿本文から抽出）

格納先の期間フォルダ名は、**請求書振込依頼の親メッセージ本文**（file-bot が振込依頼フォームから生成する定型投稿）から自動で決まります。判定は次の優先順位です（「Build CloudConvert Job」ノードの Code 内）。

1. **明示指定が最優先**: 本文に `保存先:` / `格納先:` / `フォルダ:` の行があれば、その値をそのままフォルダ名に使用
   ```
   保存先: ⭐️★2026.5.29請求分　有限会社川上産業
   ```
   → 一番確実。梅本様の既存フォルダ名と完全一致させたい場合はこの書式を推奨。
2. **file-bot 定型から自動生成**（通常はこれ）: 本文先頭の**ドット日付**（例 `2026.5.29`）と、`🏢 取引先名` ラベルの次行の値から組み立て。先頭記号は Code 内 `FOLDER_PREFIX`（既定 `⭐️★`）。
   ```
   2026.5.29              ← この日付を使用
   …
   🏢 取引先名
    有限会社川上産業       ← この取引先名を使用
   ```
   → 生成例: `⭐️★2026.5.29請求分　有限会社川上産業`
3. **汎用フォールバック**: 上記で取れない場合、任意形式の日付（`2026/5/29` / `2026年5月29日` 等）＋ `請求先:` / `宛名:` / `氏名:` から生成
4. **取りこぼし防止**: いずれも取れない場合は処理月の `⭐️★2026.6請求分_未分類` に格納（後から手動で正しいフォルダへ移動可能）

> **日付の基準について**: 既定では「投稿本文先頭のドット日付（≒ 振込依頼の投稿日）」を使用します。もし梅本様のフォルダが**支払期日**や別の日付基準であれば、Code 内の日付抽出を `📅 支払期日` ベースに切り替えられます。
>
> フォルダ名は親フォルダ配下で**完全一致**検索されるため、表記ゆれ（全角/半角スペース・記号 `⭐️★`）にご注意ください。既存フォルダと記号が違う場合は `FOLDER_PREFIX` を合わせるか、`保存先:` 行で明示してください。

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
