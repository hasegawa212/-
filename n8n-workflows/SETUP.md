# Slack Modal Workflows セットアップ Runbook

> 対象: `/daily` `/apo` `/feedback` `/meeting` の n8n + Slack + Sheets 連携を本番稼働させる
> 想定所要時間: 約 30〜45 分
> 担当: ボス（手動操作）/ Claude（MCP 経由で実行可能な箇所）

---

## チェックリスト全体

- [ ] **STEP 1**: Slack App にスラッシュコマンド 4 件登録（完了済み? 要確認）
- [ ] **STEP 2**: Slack App の Interactivity & Shortcuts URL を設定
- [ ] **STEP 3**: Google Sheets に 4 シート + ヘッダーを作成
- [ ] **STEP 4**: n8n に 5 ワークフローをインポート + 認証情報を差し替え
- [ ] **STEP 5**: 各ワークフローを Active に切り替え
- [ ] **STEP 6**: 動作確認（`/daily` → 行追加 + 通知）

---

## STEP 1: Slack Slash Commands（再掲）

api.slack.com → 該当 App → **Slash Commands** → Create New Command を 4 回。

| Command | Request URL | Short Description |
| --- | --- | --- |
| `/daily` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-daily` | 日報を報告する |
| `/apo` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-apo` | アポ追加/キャンセル |
| `/feedback` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-feedback` | 顧客フィードバック |
| `/meeting` | `https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-trigger-meeting` | 会議の確認事項（必須3つ）を記録 |

---

## STEP 2: Interactivity & Shortcuts

モーダル送信を受け取る URL を Slack 側に登録。

1. 同じ Slack App 設定画面 → **Interactivity & Shortcuts**
2. **Interactivity** を **On** に切替
3. **Request URL** に以下を入力 → Save:
   ```
   https://martial-arts-ghd.app.n8n.cloud/webhook/slack-modal-submit
   ```

これがないと「送信」ボタンを押しても n8n に届かず、Sheets 書込・通知が一切動きません。

---

## STEP 3: Google Sheets 準備

### 3-1. スプレッドシートを新規作成

名前例: `Martial Arts 業務管理 2026`

権限: 営業 + 経営層のみ（顧客匿名コード前提だが念のため制限）

### 3-2. 4 つのシート + ヘッダーを作成

#### `daily_reports`
| timestamp | callback_id | staff_slack_id | staff_slack_name | channel_id | report_date | call_count | apo_count | meeting_count | contract_count | highlights | tomorrow_plan | blockers |

#### `apo_log`
| timestamp | callback_id | staff_slack_id | staff_slack_name | channel_id | action_type | customer_code | deal_code | apo_datetime | reason |

#### `feedback_log`
| timestamp | callback_id | staff_slack_id | staff_slack_name | channel_id | deal_code | customer_code | feedback_type | rating | content | action_needed |

#### `meeting_checklist`
| timestamp | callback_id | staff_slack_id | staff_slack_name | channel_id | notify_channel | meeting_title | meeting_date | attendees | check_1 | check_2 | check_3 | owner |

**重要**: n8n の Google Sheets ノードが `autoMapInputData` モードで動くため、**ヘッダー名は完全一致が必須**です。コピペ推奨。

### 3-3. Sheet ID を控える

URL `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit` の `<SHEET_ID>` 部分。
n8n の `REPLACE_WITH_GOOGLE_SHEET_ID` に貼り付けます。

> **Claude による自動作成**: Sheet ID を共有してくれれば Claude 側で MCP 経由でヘッダー追加可能です（既存スプレッドシートに 3 シート追加 + ヘッダー投入）。新規作成も可。

#### 作成済みリソース (2026-06-02 Claude 作成)

| 項目 | 値 |
| --- | --- |
| Drive フォルダ | `Martial Arts Business` (ID: `1_TEM1gaZwiU_gW6H34GLBkh0QFQ5zxGp`) |
| スプレッドシート | `Martial Arts Business 2026` (ID: `1NMzF5QRt8dzf7lhNtaYh1Xbn5LdTQjSGExdsff5Hgi8`) |
| URL | https://docs.google.com/spreadsheets/d/1NMzF5QRt8dzf7lhNtaYh1Xbn5LdTQjSGExdsff5Hgi8/edit |
| シート | `daily_reports` / `apo_log` / `feedback_log`（全て上記ヘッダーで作成済み） |

n8n の `REPLACE_WITH_GOOGLE_SHEET_ID` には `1NMzF5QRt8dzf7lhNtaYh1Xbn5LdTQjSGExdsff5Hgi8` を貼り付けてください。

---

## STEP 4: n8n ワークフローインポート

### 4-1. 4 つの JSON をインポート

n8n.cloud → Workflows → **Import from File** で以下を順にインポート:

1. `n8n-workflows/slack-modal-trigger-daily.json`
2. `n8n-workflows/slack-modal-trigger-apo.json`
3. `n8n-workflows/slack-modal-trigger-feedback.json`
4. `n8n-workflows/slack-modal-submit-handler.json`

### 4-2. 認証情報を作成・選択

n8n の **Credentials** で以下 2 つを作成（または既存を使用）:

| 認証情報 | 用途 | スコープ |
| --- | --- | --- |
| **Slack OAuth2 API** | チャンネル通知 (`chat:write`) | `chat:write`, `chat:write.public` |
| **Google Sheets OAuth2 API** | Sheets 書込 | 標準 |

### 4-3. 各ワークフローの `REPLACE_WITH_*` を差し替え

各ワークフローを開いて HTTP/Slack/Sheets ノードに以下を入力:

| プレースホルダ | 入れる値 |
| --- | --- |
| `REPLACE_WITH_SLACK_BOT_TOKEN` | Slack App の Bot User OAuth Token (`xoxb-...`) |
| `REPLACE_WITH_SLACK_CREDENTIAL_ID` | 上で作った Slack OAuth2 credential |
| `REPLACE_WITH_GOOGLE_SHEET_ID` | STEP 3-3 で控えた Sheet ID |
| `REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID` | 上で作った Google Sheets credential |

> ℹ️ `REPLACE_WITH_SLACK_CHANNEL_ID` は **不要になりました**。
> `slack-modal-submit-handler.json` の `Notify Slack Channel` ノードは式 `{{ $json.notify_channel }}` でチャンネルを動的解決し、ID は `Parse + Normalize` ノードの `NOTIFY_CHANNEL` 定数（callback_id ごとに固定振分）から供給されます。チャンネルを変えたい場合は下記 4-3-1 の表と Code ノード両方を更新してください。

### 4-3-1. 通知先チャンネル（Claude が作成済み）

`Notify Slack Channel` ノードは 1 個ですが、`callback_id` で 4 チャンネルに振分します。マッピングは `Parse + Normalize` ノード内の `NOTIFY_CHANNEL` 定数で定義（手で書き換える場合はこの表と Code 両方を更新）。

| `callback_id` | チャンネル名 | Channel ID |
| --- | --- | --- |
| `daily_report` | `#martial-arts-daily-report` | `C0B7T9Z4J1Z` |
| `apo_action` | `#martial-arts-apo-log` | `C0B7RRM138X` |
| `customer_feedback` | `#martial-arts-feedback` | `C0B8G0E3CR2` |
| `meeting_check` | `#martial-arts-meeting-checklist` | `REPLACE_WITH_MEETING_CHANNEL_ID` ⚠️未設定 |

> ⚠️ `meeting_check` のみ Channel ID がプレースホルダです。会議の確認事項を共有したいチャンネルを作成（例: `#martial-arts-meeting-checklist`）し、その Channel ID を `Parse + Normalize` ノードの `NOTIFY_CHANNEL.meeting_check` に設定してください。

Bot が `chat:write.public` を持っていれば招待不要で投稿可能。持たない場合は各チャンネルで `/invite @<bot 名>` を実行してください。

### 4-4. Slack Bot Token のスコープ確認

api.slack.com → 該当 App → **OAuth & Permissions** → **Bot Token Scopes** に以下があるか確認:

- `commands` — スラッシュコマンド受信（必須）
- `chat:write` — チャンネル通知（必須）
- `chat:write.public` — 招待されていないチャンネルへの投稿（推奨）
- `users:read` — 担当者名解決（任意）

スコープを追加した場合は **Reinstall to Workspace** で再認可が必要。

---

## STEP 5: ワークフロー有効化

各ワークフロー画面右上の **Active** トグルを ON:

- [ ] Slack /daily → Open Daily Report Modal
- [ ] Slack /apo → Open Apo Add/Cancel Modal
- [ ] Slack /feedback → Open Customer Feedback Modal
- [ ] Slack /meeting → Open Meeting Checklist Modal
- [ ] Slack Modal Submit → Sheets + Channel Notify

---

## STEP 6: 動作確認

### 6-1. 起動テスト

Slack で:
```
/daily
```

期待挙動:
1. 即座に「📅 日報」モーダルが開く（3 秒以上かかる場合は Trigger ワークフローのエラー）
2. 適当に記入 → 送信
3. 通知先チャンネルに「📅 *日報* by @ボス ...」が投稿される
4. `daily_reports` シートに 1 行追加される

### 6-2. 他コマンドも同様に

```
/apo
/feedback
/meeting
```

`/meeting` は確認事項①〜③が**必須入力**なので、3つ全て埋めないと Slack 側で送信できません（これで「会議では必ず3つ」のルールがフォームで強制されます）。送信すると `meeting_checklist` シートに1行追加され、`meeting_check` の通知先チャンネルに共有されます。

### 6-3. うまく動かない時のチェックポイント

| 症状 | 確認箇所 |
| --- | --- |
| `/daily` 入力直後に `dispatch_failed` | Slack App の Request URL が n8n の webhook URL と完全一致しているか / ワークフローが Active か |
| モーダルが開かない | Slack Bot Token が正しいか / `chat:write` スコープがあるか / n8n の HTTP Request ノードのレスポンスを確認 |
| 送信後何も起きない | Interactivity Request URL（STEP 2）が設定されているか / Submit Handler ワークフローが Active か |
| Sheets に書き込まれない | Sheet ID 正しいか / シート名 (`daily_reports` 等) が完全一致か / ヘッダー名が完全一致か |
| Slack 通知が来ない | Slack credential の権限 / Bot がチャンネルに招待されているか |

n8n 側で各ワークフローを開き、**Executions** タブで失敗実行を確認すると詳細エラーが見られます。

---

## ロールバック

問題が出たら各ワークフローを **Active OFF** にするだけで停止します。
Slack 側のスラッシュコマンドは残りますが、応答がないだけになります。

完全に外す場合は Slack App から該当コマンドを削除。

---

## 今後の拡張アイデア

- **Slack Signing Secret 検証**: Webhook 受信時に Slack 署名を検証して不正リクエストを排除
- **エラー通知**: ワークフロー失敗時に管理者 DM
- **ダッシュボード**: `daily_reports` を BigQuery / Looker Studio で可視化
- **ステージ更新**: `/update DEAL-... 本承認` で案件パイプライン自動更新

---

_作成: Claude (PR #29 続き) / 編集自由_
