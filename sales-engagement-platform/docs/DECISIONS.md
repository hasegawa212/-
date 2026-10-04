# DECISIONS (ADR log)

形式: Context / Decision / Reason / Tradeoff / Migration impact。変更時は新しい ADR を追加し、旧 ADR に `Superseded by` を書く（削除しない）。

---

## ADR-0001 — 新規サブプロジェクトとして構築する

- **Status**: Accepted (2026-10-04)
- **Context**: リポジトリ `hasegawa212/-` は独立サブプロジェクトの集合（root に package.json / workspace なし、CLAUDE.md で明示）。既存 TAC アプリ本体のソースは本リポに存在しない。テレアポ関連は GAS（`gas/テレアポ管理.gs`, `apps-script-call-log/`）・CSV・分析 md のみ。
- **Decision**: `sales-engagement-platform/` を自己完結サブプロジェクトとして新設。既存 GAS / CSV は削除・変更しない（P4 で CSV import 互換を提供）。
- **Tradeoff**: 既存 GAS 運用と並走期間が生じる。
- **Migration impact**: なし（追加のみ）。

## ADR-0002 — リファレンス URL に到達できない

- **Status**: Accepted (2026-10-04)
- **Context**: `https://tac-martial-arts.fly.dev/tac/app` は本開発環境の egress proxy でブロックされ取得不可。
- **Decision**: 既存製品理解はリポ内の一次資料から行う: `テレアポ管理シート.csv`（24 列、架電ステータス・架電日1–3・架電結果1–3・アポ日時・担当者）、`apps-script-call-log/README.md`（結果キーワード対応表: アポ獲得/アポ予定/次回架電予定/対応不可/番号誤り/架電済み）、`経営管理/03_営業/テレアポ/個別分析.md`（優先度 A/B/C、電話可能な時間帯）。UI のコピーはしない。
- **Tradeoff**: 既存アプリの画面導線や未記録の業務ルールを見落とす可能性。→ `PRODUCT.md` の「要確認」に列挙し、URL にアクセスできる環境で再確認する。

## ADR-0003 — 技術スタック

- **Status**: Accepted (2026-10-04)
- **Decision**: Node 22 + TypeScript 5.9 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) / Fastify 5 / Zod 4 / Vitest 5 / ESLint (typescript-eslint strictTypeChecked) / Prettier。DB は PostgreSQL 16（P2 で導入）。
- **Reason**:
  - TypeScript 7 は利用可能だが typescript-eslint 8.71 の peer が `<6.1.0`。lint gate を壊さないため 5.9 に固定。
  - Fastify: 保守が活発、JSON schema 検証と pino（構造化ログ + redaction hook）を内蔵 → 追加依存を最小化。
  - Zod: 外部入力の runtime validation（TS 型は validation ではない）。
  - PostgreSQL: 二重発信防止に必要な行ロック / 一意制約 / トランザクション（outbox）を正しく持つ。本環境に PG16 がありテストを実 DB で回せる。
- **Rejected**: Next.js フルスタック（Domain と UI の結合を招きやすい・P0 で不要）、SQLite（並行発信の race condition テストが本番と同じ意味論にならない）、ORM（P2 で再評価。まずは SQL migration + 薄い repository）。
- **Tradeoff**: フロントエンドは P9 で別途選定（React + Vite を第一候補、ADR を追加する）。

## ADR-0004 — Outbound kill switch は既定で「停止」

- **Status**: Accepted (2026-10-04)
- **Decision**: `OUTBOUND_KILL_SWITCH` 未設定 = 発信停止。運用者が `false` を明示した時だけ発信可能。
- **Reason**: Safety > Automation。設定漏れで実顧客へ発信される事故を構造的に防ぐ。
- **Tradeoff**: 初回デプロイ時に明示解除の手順が必要（RUNBOOK に記載予定）。P7 以降で DB 上の動的 kill switch（管理画面から即時停止）を追加し、env はその上位の強制停止として残す。

## ADR-0005 — AUTO_DIAL は production で起動拒否

- **Status**: Accepted (2026-10-04)
- **Decision**: `NODE_ENV=production` かつ `AUTO_DIAL_ENABLED=true` は ConfigError で起動しない。
- **Reason**: Rate limit / consent policy / campaign pacing が未実装の段階で auto dial は安全に成立しない。
- **Migration impact**: P6 完了時にこの制約を「前提条件が満たされている場合のみ許可」に置き換え、本 ADR を Supersede する。

## ADR-0006 — レイヤ境界を lint で強制

- **Status**: Accepted (2026-10-04)
- **Decision**: `src/domain/**` から fastify / pino / pg / react / `node:*` / 外側レイヤ（application, infrastructure, interface）の import を ESLint `no-restricted-imports` で禁止。
- **Reason**: 「Domain をフレームワークから独立させる」をレビュー頼みにせず機械的に保証する。

## ADR-0007 — ログの PII redaction を logger 層で強制

- **Status**: Accepted (2026-10-04)
- **Decision**: pino の `formatters.log`（構造化フィールド）と `hooks.logMethod`（メッセージ文字列）の両方で redaction を適用。電話番号は末尾 4 桁のみ、secret / transcript / email キーは値ごと除去。
- **Reason**: 呼び出し側の注意に依存しない。全角数字・ハイフン揺れ・`+81` 表記も検出。
- **Tradeoff**: 10–11 桁の 0 始まり数字列は電話番号として過剰マスクされうる（安全側の誤検知として許容）。
