# 最終セットアップ・チェックリスト（請求書×振込受付書 PDF結合ワークフロー）

n8n ワークフロー「**Slack の反応 → 請求書 + 領収書 PDF マージ → ドライブ (請求分) [修正済み]**」の
仕上げ手順です。本体・配線・認証はすべて完了済み。残りは下記だけです。

## ✅ ここまで完了していること
- 正規版（`invoice-receipt-pdf-merge.FIXED.json`）を n8n にインポート済み
- ワークフローは **Active（緑）**
- Slack の Event Subscriptions：Request URL **Verified 済み**、`reaction_added` 購読済み
- 認証の配線済み：
  - Slack 4ノード → `Slack account 103`（OAuth）
  - CloudConvert 2ノード → `Header Auth account 4`
  - Google Drive 3ノード → `Google Drive account 19`
  - Google Sheets → `Google Sheets account 9`（台帳 `merge_log` / シートID `1lbKD-...`）
- 「Build CloudConvert Job」コード内の Slack Bot Token 置換済み
- 格納先ロジック：`ma_payment` 共有ドライブ → 最新「★…請求分」→「4.支払いの請求書全て…」

## ⬜ 残り：成功テストを1回取るだけ（3条件をすべて満たす）
1. **bot をチャンネルに招待**：対象チャンネルで `/invite @MR`
2. **トリガー絵文字は `moneybag`（💰）**（標準絵文字なので**登録は不要**・誰でもすぐ押せる）
   - 「Parse Slack Event」ノードは `const TARGET = 'moneybag';` 済み（本リポジトリの
     `*.FIXED.json` / `*.configured.json` は反映済み）
   - ※ `white_check_mark`(✅) は完了表示に使用済みなので**トリガーにしない**（無限ループ防止）
3. **テスト投稿の構成**
   - 親メッセージ＝**請求書PDF（.pdfファイル）を添付**（画像はNG）
   - その**スレッド返信**＝振込受付書（スクショ画像 or PDF）
   - 親メッセージに **💰（`moneybag`）** を付ける（絵文字検索で `moneybag` → 選択）

→ 30秒〜1分で、スレッドに ✅ ＋「結合して格納しました」、
   Drive の最新「★…請求分 / 4.支払いの請求書全て…」に結合PDFが入れば**完成**。

## 🔍 うまくいかない時の切り分け（n8n → Executions）
- リアクション後、Executions に**新しい実行が出ない** → bot がチャンネルに居ない（`/invite @MR`）
- 実行は出るが一瞬で終わる（数十ms）→「Parse Slack Event」の出力が `skip:true` =
  付けた絵文字が `moneybag`（💰）でない（絵文字を確認）
- 「Files found?」が false（請求書PDF＋振込受付書が揃っていない）→ **何も通知せず静かに終了**
  （以前の「⚠️ 見つかりません」投稿は出さない仕様。揃っていない場合は実行ログのみで確認）

## 🔴 セキュリティ（重要）
チャットに貼った以下の鍵は、作業後に**必ず無効化・再発行**してください：
- Slack Bot Token（再発行したら「Build CloudConvert Job」コードの `Bearer xoxb-...` も更新）
- n8n API キー（複数）
- Anthropic API キー

## メモ
- 月初は、その月の「★YYYY.M.25請求分」フォルダと中の「4.支払いの請求書全て…」を
  先に用意しておけば、最新フォルダとして自動で格納されます。
- 同名の「★…請求分」フォルダが複数あると最新判定が曖昧になるため、1期間1フォルダ推奨。
