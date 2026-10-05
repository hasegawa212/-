# PROGRESS

> 実装状態の Single Source of Truth。作業を再開するときは最初にこのファイルを読む。
> ステータス語彙: DONE / IN PROGRESS / PARTIAL / BLOCKED / NOT IMPLEMENTED / MOCK ONLY。

# Current Phase

Phase 1 delta DONE → **次の Phase 2 (Database) は ADR-0011（tac-next との統合判断）待ち**

# Completed

- Phase 0 Foundation — DONE
  - tooling: TS strict / ESLint（レイヤ境界ルール付き）/ Prettier / Vitest + coverage gate / CI
  - config と feature flags。kill switch は既定で engaged
  - error taxonomy、PII redaction、`/health` と `/config`、request id
- Phase 0 delta（2026-10-05）— DONE: production safety limits を設定値として検証（`0 = 無制限` は存在しない、時間帯の矛盾は起動拒否、ブラウザには出さない）
- Phase 1 Domain — DONE（純関数のみ）: 電話番号 / suppression（fail closed）/ calling window / call 状態機械 / guard pipeline / outcome / 会話状態機械と拒否検知 / evals
- Phase 1 delta（2026-10-05）— DONE
  - TAC 5 ボタン・フォロー 5 分類の写像（未知ラベルは拒否。連絡停止 → STOP_REQUESTED）
  - outcome に WON と CONSIDERING を追加（検討は +3 日で FOLLOW_UP）
  - 会話: PERMISSION 状態、COMPLAINT 検知 → HANDOFF（拒否を伴えば STOPPING が優先）、`takeOver` / `canAiSpeak`（人の引継ぎは不可逆）
  - `reconcileProviderEvent`: webhook の重複・後退・終端後を無視し、欠けた中間状態を補完
- Design（STEP 1–15, 2026-10-05）— DONE
  - EXISTING_APP_AUDIT（現行 TAC のソース監査、Feature Audit Matrix、リスク R1–R15）
  - Domain Model、Mermaid 図（状態機械・ERD・アーキテクチャ・task graph）、API Map
  - Voice / AI アーキテクチャ、STRIDE 脅威モデル、TDD 戦略

# In Progress

- none

# Blocked

- **ADR-0011（Proposed）**: 同じ目的の `hasegawa212/-6780/tac-next` が並行して存在する。どちらに一本化するか、オーナーの判断が必要。決まるまで DB・UI など大きな投資は保留する。
- 参照 URL と公式ドキュメント（OpenAI / Twilio）は egress でブロックされている。Voice 系の仕様は検索結果の抜粋でしか確認できていないので、P11/P12 の着手前に再検証が必要。

# Next

1. ADR-0011 の決定
2. Phase 2 Database（統合先で実施）
3. 現行 TAC の重大リスク R1–R5・R8 の修正は、別途オーナー判断（現行リポジトリでの修正）

# Known Issues / Deviations

- logger.ts は実装をテストより先に書いた（TDD からの逸脱。事後テストと mutation 確認で補った）。evals はデータセットなので TDD の駆動対象ではない。
- 要件変更（PERMISSION 挿入）に伴い、既存テスト「DISCLOSURE → IDENTIFICATION 可」を更新した。実装に合わせてテストを弱めたのではなく、仕様が変わったため。
- 残る未カバー分岐は到達不能な防御フォールバックのみ（`?? 0` など）。
- 〔要法務確認〕項目は COMPLIANCE.md を参照。
- 永続化が必要な DNC 要件は NOT IMPLEMENTED（TESTING.md の表を参照）。

# Tests Status

- unit + integration: 349 PASS（evals 35 件を含む）
- critical mutant smoke: 25/25 killed
- E2E: NOT IMPLEMENTED

# Build Status

- format / lint / typecheck / coverage gate / build: PASS（`npm run verify` exit 0）

# TDD Evidence (RED → GREEN), 2026-10-05 delta

| Module                                                   | RED observed                                    | GREEN |
| -------------------------------------------------------- | ----------------------------------------------- | ----- |
| config safety limits                                     | 新規 17 件がアサーションで失敗（limits 未定義） | 26    |
| tacMapping                                               | モジュール不在                                  | 14    |
| outcome WON / CONSIDERING                                | CONSIDERING の follow-up が null                | 30    |
| conversation safety（PERMISSION / COMPLAINT / takeover） | 遷移・検知・takeover がアサーションで失敗       | 17    |
| reconcile                                                | モジュール不在                                  | 12    |
| mutation smoke（追加 6）                                 | —                                               | 25/25 |

# Last Verified

2026-10-05 — `npm run verify` PASS、`npm run test:mutation` 25/25
