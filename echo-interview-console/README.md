# 反響面談コンソール（echo-interview-console）

株式会社 Martial Arts の反響対応・オンライン面談で使うヒアリング入力コンソールです。
面談中に伺った内容を入力して保存すると、**Google スプレッドシートの「ヒアリングシート」へ
1 行で確実に反映**されます（既存 53 列 A〜BA を 1 項目=1 列でマッピング）。

- フロント：`index.html` / `styles.css` / `app.js` / `fields.js`（依存ゼロのバニラ JS, ES Modules）
- 書き込み：`apps-script/Code.gs`（Google Apps Script ウェブアプリ）
- 入力データはブラウザの localStorage に自動で一時保存されます（セッション単位）。

## なぜ「しっかり反映」されるのか

`fields.js` がコンソールの入力項目とスプレッドシートの列を **1:1** で定義し、Apps Script は
列文字（A, B, … BA）でそのまま書き込みます。Slack の「反響顧客ヒアリングサマリー」に出る
項目はすべて行き先を持つため、**取りこぼしが起きません**。サマリーにあって従来シートに
専用列のなかった「エリア理由 / 絶対条件 / 希望条件 / 将来像」は、シートの列を増やさずに
**備考（AY 列）へ「【ラベル】値」の形で畳み込んで**保存します（`mergeInto` 指定）。

## セットアップ

### 1. 書き込み先（Apps Script ウェブアプリ）

1. 対象スプレッドシート（`⭐️反響管理シート（martialhp連動）`）を開く → **拡張機能 → Apps Script**。
2. `apps-script/Code.gs` の内容を貼り付け。別ブックを使う場合は `SPREADSHEET_ID` を設定。
3. **デプロイ → 新しいデプロイ → 種類「ウェブアプリ」**
   - 実行ユーザー：**自分**
   - アクセスできるユーザー：**全員**
4. 発行された `…/exec` URL を控える。

> 既定の保存先は `ヒアリングシート①`。コンソール右上の「保存先」で ②③ に切替可。
> データ行は 26 行目以降、お客様名（E 列）が空の最初の行に追記されます。

### 2. コンソールの起動

ビルド不要・静的ファイルです。任意の静的配信で開けます。

```bash
cd echo-interview-console
python3 -m http.server 5180
# → http://localhost:5180
```

初回に右上「⚙︎ 設定」で **Apps Script のウェブアプリ URL** を登録してください
（ブラウザの localStorage に保存）。

セッション付きで開くと閲覧 URL が記録されます：
`http://localhost:5180/?session=ABC123`

## 使い方

1. 面談しながら各セクション（受付・基本／現状／資金計画／希望エリア・勤務／物件条件／
   ライフプラン・本音／次アクション）を入力。
2. **「📝 サマリー生成」**で Slack 投稿用の整形テキストを生成・コピー。
3. **「💾 シートに保存」**でヒアリングシートへ 1 行追記。`保存日時`(AZ) と `閲覧URL`(BA) は自動。

## 列マッピング

`fields.js` の `FIELDS` が唯一の定義元です。列を増減・並べ替えたら、
`apps-script/Code.gs` の `HEADERS` とスプレッドシート 25 行目ヘッダも合わせてください。

| 区分 | 行き先 |
| --- | --- |
| 既存ヒアリングシート | A〜BA（53 列）に 1 項目=1 列 |
| 専用列なし（質的項目） | エリア理由 / 絶対条件 / 希望条件 / 将来像 → 備考(AY) に畳み込み |

## 自動化（apps-script/Automation.gs）

`Code.gs` と同じ Apps Script プロジェクトに `Automation.gs` を追加すると、4つの自動化が使えます。
プロジェクトの「スクリプト プロパティ」に必要なキーを設定してください。

| プロパティ | 用途 |
| --- | --- |
| `SLACK_WEBHOOK_URL` | #1/#4 Slack Incoming Webhook |
| `ANTHROPIC_API_KEY` | #3 Claude API キー |
| `ANTHROPIC_MODEL` | 省略時 `claude-opus-4-8`（コスト優先なら `claude-haiku-4-5` 等） |

- **#1 Slackサマリー → シート自動転記**：Slackの「反響顧客ヒアリングサマリー」本文を
  `doPost`（`{"action":"importSummary","text":"...","sheet":"ヒアリングシート①"}`）へPOSTすると、
  53列を解析してシートに追記。**n8nワークフロー** `n8n-workflows/slack-summary-to-hearing-sheet.json`
  を使うのが推奨です（Slackトリガー→サマリー判定→本Web AppへPOST）。インポート後、
  `REPLACE_WITH_SLACK_CHANNEL_ID`（反響チャンネル）/ `REPLACE_WITH_SLACK_CREDENTIAL_ID` /
  `REPLACE_WITH_APPS_SCRIPT_WEBAPP_URL`（デプロイURL）を差し替えて有効化してください。
- **#2 反響フォーム → ヒアリング下書き自動作成**：`importInquiriesToDrafts()` が反響管理シートの
  新規行を検知し、氏名・連絡先・流入元・希望エリア等を入れた下書き行をヒアリングシートへ追記
  （取り込み済みはマーカーで二重防止）。**時間主導トリガー**（例：5分おき）に登録、または
  シート上部メニュー「反響自動化 → 反響→ヒアリング下書きを同期」から手動実行。
- **#3 Zoom録画 → AI要約 → シート自動入力**：`doPost`
  （`{"action":"extractTranscript","transcript":"...","sheet":"..."}`）へ文字起こしを送ると、
  Claude（`claude-opus-4-8`）が53列に構造化してシートへ追記。Zoom録画の文字起こしをn8n等で渡します。
- **#4 コンソール保存時にSlackも同時投稿**：コンソールの「保存時にSlackへも投稿」にチェックして保存すると、
  シート反映と同時にSlackへサマリーを投稿（`SLACK_WEBHOOK_URL` 設定時）。

## メモ

- ビルド・テスト・Lint はありません（リポジトリの他サブプロジェクトと独立）。
- 個人情報（顧客名・連絡先等）を含むため、入力内容を外部サービスへ貼り付けないこと。
- CORS：保存は `text/plain` で POST し、Apps Script 側のプリフライトを回避しています。
