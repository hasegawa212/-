# n8n Workflows

このディレクトリには n8n にインポート可能なワークフロー JSON が格納されています。

## ワークフロー一覧

| ファイル | 用途 |
| --- | --- |
| `telegram-to-sheets-slack.json` | Telegram → Sheets + Slack 通知（既存） |
| `gmail-reservation-to-sheets-slack.json` | Gmail（来場予約メール）→ Sheets 追記 + Slack 通知（**OAuth2認証**） |
| `slack-modal-trigger-daily.json` | `/daily` → 日報モーダル表示 |
| `slack-modal-trigger-apo.json` | `/apo` → アポ追加/キャンセル モーダル表示 |
| `slack-modal-trigger-feedback.json` | `/feedback` → 顧客フィードバック モーダル表示 |
| `slack-modal-trigger-meeting.json` | `/meeting` → 会議の確認事項（必須3つ）モーダル表示 |
| `slack-modal-submit-handler.json` | 4 つのモーダル送信を一括処理（Sheets append + Slack 通知） |
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

- **トリガー**: 親メッセージへの特定絵文字リアクション（`REPLACE_WITH_TRIGGER_EMOJI`、既定: `moneybag` = 💰。標準絵文字なのでワークスペースへの絵文字登録は不要）
- **結合エンジン**: CloudConvert（画像のPDF化と複数PDFの結合を1ジョブで実行）
- **保存先**: 梅本様共有の **`ma_payment` 共有ドライブ** 内、**最新の `★…請求分` 月次フォルダ**の中の **`4.支払いの請求書全て（振込、引き落とし）`** サブフォルダへ自動格納（サブフォルダが無い場合は月フォルダ直下にフォールバック）
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
                                                                   → List 請求分 Folders（共有ドライブ）
                                                                   → Pick Latest 請求分（最新の月フォルダ選定）
                                                                   → Find 支払い Subfolder（4.支払い…）
                                                                   → Resolve Target Folder（格納先ID確定）
                                                                   → Download Merged PDF
                                                                   → Upload to Drive（4.支払い… へ）
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

### 3. Google Drive（共有ドライブ `ma_payment`）
- 格納先は **`ma_payment` 共有ドライブ**内の `★…請求分` 月次フォルダ群です。次の ID は調査済みで JSON に直接埋め込まれています（変わった場合のみ差し替え）:
  - 共有ドライブ ID（`driveId`）: `0AM6Ft-LAGZvNUk9PVA`（`ma_payment`）— `List 請求分 Folders` / `Find 支払い Subfolder` / `Upload to Drive` の各ノード
  - `★…請求分` フォルダの親フォルダ ID: `16_5uX0SptbHkSwpC9r-AmbnyBTX9eg44` — `List 請求分 Folders` の検索クエリ `q`
- n8n の **Credentials → New → Google Drive OAuth2 API** を登録（このワークフローでは `Google Drive` という名前で参照）。**共有ドライブ `ma_payment` に書き込める Google アカウント**で認可してください。
- ※ 月次フォルダ（`★YYYY.M.25請求分`）と中の `4.支払い…` サブフォルダは**人手で用意されている前提**です。ワークフローは新規作成せず、既存の最新フォルダを探して格納します。

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
   | `REPLACE_WITH_TRIGGER_EMOJI` | トリガーにする絵文字名（`:` なし。既定 `moneybag` = 💰。標準絵文字なので登録不要） |
   | `REPLACE_WITH_SLACK_HEADER_CREDENTIAL_ID` | Slack Bot Token の Header Auth credential |
   | `REPLACE_WITH_SLACK_BOT_TOKEN` | Bot User OAuth Token（`xoxb-...`）※「Build CloudConvert Job」ノードの Code 内。CloudConvert が Slack の非公開ファイルURLを取得するために使用 |
   | `REPLACE_WITH_CLOUDCONVERT_CREDENTIAL_ID` | CloudConvert の Header Auth credential |
   | `REPLACE_WITH_GOOGLE_DRIVE_CREDENTIAL_ID` | Google Drive OAuth2 credential（`List 請求分 Folders` / `Find 支払い Subfolder` / `Upload to Drive` の3ノード。`ma_payment` 共有ドライブに書き込める権限で認可） |
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
| List 請求分 Folders | `ma_payment` 共有ドライブの親フォルダ配下にある `★…請求分` 月次フォルダを一覧取得 |
| Pick Latest 請求分 | フォルダ名の日付（`YYYY.M.D`）が最大のものを「最新」として選定（同名重複は `createdTime` が新しい方） |
| Find 支払い Subfolder | 選定した月フォルダ内の `4.支払いの請求書全て（振込、引き落とし）` サブフォルダを検索 |
| Resolve Target Folder | 格納先フォルダ ID を確定（サブフォルダが無ければ月フォルダ直下にフォールバック） |
| Download Merged PDF | 結合PDFをバイナリで取得 |
| Upload to Drive | 確定した格納先（`ma_payment` 共有ドライブ内）へ格納 |
| Append merge_log | 台帳（請求書名・ファイル名・フォルダ・Driveリンク）に記録 |
| Notify Thread (done) / Add Done Reaction | スレッドに完了報告＋✅ で処理済みを可視化 |
| Notify Missing Files | 請求書/受付書が不足している場合にスレッドへ差し戻し |

## 運用上の注意

- **リアクションは「親メッセージ（請求書PDF投稿）」に付ける**こと。受付書は同じスレッドに返信しておく必要があります。
- 受付書が画像（スクショ）でも PDF でも、いずれも結合対象として処理します（画像は自動でPDF化）。
- **分割払い等で複数の受付書**がある場合も対応済みです。スレッド内の受付書（画像/PDF）を**全件、Slack投稿順（時系列＝アップロード日時 `created` の昇順）で**請求書の後ろに結合します（請求書 → 受付書1 → 受付書2 …）。1スレッドに受付書を複数返信しておけば、まとめて1つのPDFになります。
- 重複処理防止のため、処理済みには `:white_check_mark:` が付きます。トリガー絵文字とは別の絵文字にしてあるためループしません。

## 格納先（請求分フォルダ）の決まり方

実際の Drive 構造（`ma_payment` 共有ドライブ）に合わせて、**フォルダは自動作成せず・既存の最新フォルダへ格納**します。

```
ma_payment（共有ドライブ）
└─ 親フォルダ 16_5uX0SptbHkSwpC9r-AmbnyBTX9eg44
   ├─ ★2026.3.25請求分
   │    ├─ 1.預金通帳
   │    ├─ 2.不動産売買契約書（AB間契約書、BC間契約書）
   │    ├─ 3.リフォーム、新築等工事売上の請求書
   │    ├─ 4.支払いの請求書全て（振込、引き落とし）  ← ここへ格納
   │    └─ 5.その他資料
   ├─ ★2026.5.3請求分
   └─ …（毎月の月次フォルダ）
```

1. `List 請求分 Folders` … 親フォルダ配下の `★…請求分` 月次フォルダを一覧
2. `Pick Latest 請求分` … フォルダ名の日付（`YYYY.M.D`）が**最大のもの**を「最新」として選定（同名が複数ある場合は `createdTime` が新しい方）
3. `Find 支払い Subfolder` … その月フォルダ内の `4.支払いの請求書全て（振込、引き落とし）` を検索（先頭が `4.支払` で前方一致）
4. `Upload to Drive` … 見つかった `4.支払い…` サブフォルダへ格納（無ければ月フォルダ直下にフォールバック）

> **運用上の前提**: 月次フォルダ（`★YYYY.M.25請求分` 等）と中の `4.支払い…` サブフォルダは、**人手で用意されている**ことが前提です。新しい月に入ったらフォルダを先に作成しておけば、その月の最新フォルダへ自動で入ります。
>
> **注意（重複フォルダ）**: 同名の `★…請求分` フォルダが複数あると「最新」判定が曖昧になります（現状 `★2026.5.3請求分` が2件存在）。1期間1フォルダの運用を推奨します。
>
> **月の選定を変えたい場合**: 「最新」ではなく「支払期日の月」「処理日の月」「投稿で明示」等に変えたいときは、`List 請求分 Folders` の `q` と `Pick Latest 請求分` の選定ロジックを調整します（ご相談ください）。

---

# Slack Modal Workflows（業務フォーム連携）

`/daily` `/apo` `/feedback` `/meeting` の 4 スラッシュコマンドからモーダルを開き、送信内容を Google Sheets に蓄積 + Slack チャンネルに通知。

> **会議の「必ず3つの質問・確認事項」ルールの共有・管理は `/meeting` を使う。** 会議終了時に `/meeting` を打つと確認事項①〜③（必須入力）のモーダルが開き、送信すると `meeting_checklist` シートに1行追記され、`#martial-arts-meeting-checklist` 等のチャンネルへ自動共有される。3つ揃わないと Slack 側で送信できないため、ルールがフォームで強制される。

## フロー全体図

```
[Slack User]
    │ /daily, /apo, /feedback, /meeting
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
                                  ├─ customer_feedback → Sheets: feedback_log
                                  └─ meeting_check     → Sheets: meeting_checklist
                                       ↓
                                  Slack Channel Notify
```

## セットアップ手順

### 1. n8n でワークフローをインポート

5 つの JSON を全てインポートし、各 `REPLACE_WITH_*` を実値に置換:
- `REPLACE_WITH_SLACK_BOT_TOKEN` → Slack Bot User OAuth Token (`xoxb-...`)
- `REPLACE_WITH_SLACK_CREDENTIAL_ID` → n8n Slack credential
- `REPLACE_WITH_GOOGLE_SHEET_ID` → スプレッドシート ID
- `REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID` → n8n Google Sheets credential

> 通知先チャンネルは `slack-modal-submit-handler.json` の `Parse + Normalize` ノード内の `NOTIFY_CHANNEL` 定数で `callback_id` ごとに固定振分（Slack ノードは `{{ $json.notify_channel }}` で参照）。4 チャンネルとも設定済み（`meeting_check` = `#martial-arts-meeting-checklist` / `C0B9RAHM13K`）。差し替え対象なし。詳細は `SETUP.md` §4-3-1。

### 2. Slack App 設定

**Slash Commands**（3 件登録）:
| Command | Request URL |
| --- | --- |
| `/daily` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-daily` |
| `/apo` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-apo` |
| `/feedback` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-feedback` |
| `/meeting` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-meeting` |

**Interactivity & Shortcuts**（Request URL）:
```
https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-submit
```

**Bot Token Scopes**:
- `commands` — スラッシュコマンド受信
- `chat:write` — チャンネル通知
- `users:read` — ユーザー情報取得（オプション）

### 3. Google Sheets 準備

スプレッドシートに 4 つのシートを作成:

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

**`meeting_checklist`**
```
timestamp | callback_id | staff_slack_id | staff_slack_name | channel_id |
notify_channel | meeting_title | meeting_date | attendees |
check_1 | check_2 | check_3 | owner
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

---

# n8n Workflow: Gmail（来場予約）→ Google Sheets + Slack（`gmail-reservation-to-sheets-slack.json`）

来場予約のメールを **Gmailトリガー（来場予約）** で受信し、本文から氏名・希望日時・電話を抽出して Google Sheets に追記、同時に Slack へ通知します。

## フロー図

```
Gmailトリガー（来場予約） → 予約情報を整形 ┬→ 来場予約をシートに追記（Google Sheets）
                                          └→ Slackに通知
```

## ⚠️ RS256 / 認証エラーについて（重要）

`RS256 を使用する場合、secretOrPrivateKey は非対称鍵である必要があります` というエラーは、Gmailを **サービスアカウント（JWT）認証**にしたときに、秘密鍵欄へ RSA 秘密鍵以外（プレーンな文字列・空・PEMヘッダ欠落・改行破損）が入っていると発生します。

**本ワークフローはこれを避けるため `gmailOAuth2`（OAuth2 認証）を使用しています。** OAuth2 では JWT の RS256 署名を自分で行わないため、このエラーは原理的に発生しません。サービスアカウントをどうしても使う場合は、サービスアカウント JSON の `private_key` 値を `-----BEGIN PRIVATE KEY-----` 〜 `-----END PRIVATE KEY-----` ごと（改行を保ったまま）貼り、Workspace のドメイン全体の委任を設定してください。

## 事前準備

### 1. Gmail（OAuth2）
- n8n で **Gmail OAuth2 API** credential を作成（Google Cloud で OAuth クライアントを発行し、`https://www.googleapis.com/auth/gmail.readonly`〔または `gmail.modify`〕スコープを許可）
- 受信トレイで来場予約メールに**ラベル**を付けておくと精度が上がる（フィルタの `q` をラベル検索に変更可能）

### 2. Google Sheets
- スプレッドシートに **`来場予約`** シートを作成し、1行目に次のヘッダーを用意:
  `received_at | email_date | from | subject | name | phone | preferred_datetime | body | message_id`

### 3. Slack
- 通知先チャンネルに Bot を招待（`chat:write`）

## インポート手順

1. n8n → Import from File → `gmail-reservation-to-sheets-slack.json`
2. 各 `REPLACE_WITH_*` を自分の値に置き換える:
   - `REPLACE_WITH_GMAIL_CREDENTIAL_ID` → Gmail **OAuth2** 認証情報
   - `REPLACE_WITH_GOOGLE_SHEET_ID` → スプレッドシート ID
   - `REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID` → Google Sheets 認証情報
   - `REPLACE_WITH_SLACK_CHANNEL_ID` → Slack チャンネル ID
   - `REPLACE_WITH_SLACK_CREDENTIAL_ID` → Slack 認証情報
3. ワークフローを **Active** にする

## ノード詳細

- **Gmailトリガー（来場予約）** (`gmailTrigger`, OAuth2): 毎分ポーリング。`filters.q` = `subject:(来場予約 OR 来場 OR 内見予約) -from:me`、未読のみ（`readStatus: unread`）。検索条件は用途に合わせて変更可（例: `label:来場予約`）。
- **予約情報を整形** (`set`): 受信日時・差出人・件名のほか、本文から「お名前/氏名」「希望日時/来場日時」「電話/連絡先」を正規表現で抽出。抽出できない場合は空文字。
- **来場予約をシートに追記** (`googleSheets`, append): `来場予約` シートへ1行追記。
- **Slackに通知** (`slack`): 予約サマリー（氏名・希望日時・電話・差出人・件名・本文先頭500字）を mrkdwn で投稿。

## カスタマイズ

- **抽出精度**: 予約メールのフォーマットが固定なら、`予約情報を整形` の正規表現を実際のラベル文言（例: 「ご希望日：」）に合わせて調整。
- **取りこぼし防止**: `readStatus` を `both` にし、処理済みメールには Gmail ノードでラベル付与/既読化を追加。
- **重複防止**: Google Sheets を append ではなく `message_id` で upsert に変更。
- **要約**: `Append to Google Sheets` の前に OpenAI/Claude ノードを挟んで要約を保存
