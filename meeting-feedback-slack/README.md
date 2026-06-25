# meeting-feedback-slack — 会議フィードバックを一人ひとりに個別DM

会議の参加者**一人ひとり**に、その人だけのフィードバックを Slack の**個別DM**で送る、依存ゼロの Node CLI です。

## 思想

> 会議は「意見交換の場」。聞いているだけ・黙っているだけ、はナシ。

このツールは必ず **発言量・参加度** と **次回アクション** をフィードバックします。
発言ゼロだった人には、次回は必ず意見を出すよう背中を押す文面が自動で入ります。

## セットアップ

```bash
cd meeting-feedback-slack
cp .env.example .env          # SLACK_BOT_TOKEN を設定（xoxb-...）
```

必要な Bot スコープ: `chat:write`, `im:write`、email 宛先を使うなら `users:read.email`。

## 使い方

```bash
# 1) まずドライラン（送らずに文面プレビュー。トークン不要）
node send-feedback.js -p participants.csv --dry-run

# 2) 本番送信
node send-feedback.js -p participants.csv

# 送信間隔を空ける / 発言が少ない閾値を変える / 自前テンプレを使う
node send-feedback.js -p participants.csv --delay 1500
node send-feedback.js -p participants.csv --low 2
node send-feedback.js -p participants.csv --template template.txt
```

## 参加者CSV

1行 = 1人。人ごとに内容が違います。宛先以外の列はすべて任意。

| 列 | 用途 |
|----|------|
| `email` または `slack_id` | 宛先（両方あれば `slack_id` 優先） |
| `name` | 宛名（あると文頭が「○○さん、」になる） |
| `会議名` / `日付` | 見出しに使う |
| `発言回数` | 数値。0なら強めの一押し、`--low`(既定3)未満ならもう一歩、以上なら好評価 |
| `良かった点` / `改善点` | あれば該当セクションに表示 |
| `次回アクション` | 必ず表示。未指定なら「最低1回は意見を出す」が既定で入る |
| `一言` | 末尾に自由文として添える |

例は `participants.example.csv` を参照（コピーして `participants.csv` を作成）。

## 自動生成される文面（例）

発言回数 0 の人:

```
山田太郎 さん、お疲れさまでした！
6/25 週次定例 のフィードバックです。

*■ 発言・参加について*
今回の発言: 0回
今回は発言ゼロでした。会議は意見交換の場です。黙って座っているだけなら、その時間はもったいない。次回は最低でも1回、必ず意見を出しましょう。…

*■ 次回アクション*
・次回は議題ごとに最低1回は意見を出す
```

## カスタム文面（任意）

`--template` でテンプレを渡すと `{{列名}}` 差し込みで自由に組めます。
計算列 `{{発言コメント}}`（発言回数から生成される参加度コメント）も使えます。
雛形は `template.example.txt`。

## メモ

- 依存ゼロ（Node 18+ の global `fetch` のみ）。ビルド/テスト/Lint なし。
- `.env` / `participants.csv` / `feedback-log-*.csv` / `template.txt` は PII のため `.gitignore` 済み。`*.example.*` だけ追跡します。
- 各送信ごとに `feedback-log-*.csv` を残します（成功/失敗の記録）。
- 既存の `slack-bulk-messaging/`（同報の個別DM）と同じ作法。違いは「人ごとに内容が違うフィードバックを、発言量・次回アクション軸で構造化して送る」点です。
