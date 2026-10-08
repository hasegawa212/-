# TESTING

## コマンド

| 目的                      | コマンド                |
| ------------------------- | ----------------------- |
| 全ゲート（CI と同等）     | `npm run verify`        |
| unit + integration        | `npm test`              |
| coverage（domain に閾値） | `npm run test:coverage` |
| critical mutant smoke     | `npm run test:mutation` |

## 方針

- **TDD**: Behavior 定義 → failing test → RED を確認 → 最小実装 → GREEN → REFACTOR → 回帰。RED の証跡は PROGRESS.md に記録。
- テストを実装都合で弱めない。`test.skip` / `test.only` / expectation の緩和を禁止。
- `vitest` は `sequence.shuffle: true`（順序依存の検出）。
- Domain coverage 閾値: branches ≥ 95%, functions 100%, lines/statements ≥ 95%。
- AI 評価はスナップショット一致ではなく **policy / required behavior / forbidden behavior / state transition** を評価する（`test/evals.test.ts`）。

## Mutation testing（ADR-0009）

`scripts/mutation-smoke.mjs` が安全上重要な 25 個の変異（DNC 判定反転、fail-open、kill switch 無視、AI 発信許可、終端状態の再開、停止後の説得、開示スキップ、再勧誘…）を 1 つずつ適用し、domain テストが **必ず失敗する** ことを確認する。
初回実行で 2 つの生存 mutant を検出し、テストを強化済み:

1. 予算不明（`remainingYen: null`）チェック削除 → 見積 0 円で `null >= 0 === true` となり発信が通るケースを未検証だった。
2. 「電話をかけないで」系フレーズが冗長パターンでしか検証されていなかった。

## 最重要: DNC テスト対応表

| 要件                                         | 状態                                                     | テスト                                                     |
| -------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| DNC contact cannot be called                 | DONE (domain)                                            | `suppression.test.ts`, `outboundGuards.test.ts`            |
| DNC applies across campaigns                 | DONE (domain)                                            | `suppression.test.ts`                                      |
| operator cannot bypass                       | DONE (domain: override 経路が存在しない + 全権限で DENY) | `outboundGuards.test.ts`                                   |
| AI cannot bypass DNC                         | DONE (domain: AI_AGENT 発信不可, 拒否で強制 STOPPING)    | `outboundGuards.test.ts`, `conversation.test.ts`, `evals/` |
| DNC contact cannot enter queue               | NOT IMPLEMENTED (P6)                                     | —                                                          |
| DNC survives retry                           | NOT IMPLEMENTED (P7: retry 時も guard 再評価)            | —                                                          |
| DNC survives application restart             | NOT IMPLEMENTED (P2/P5: 永続化)                          | —                                                          |
| duplicate webhook cannot undo DNC            | NOT IMPLEMENTED (P8)                                     | —                                                          |
| DNC E2E (Call → 拒否 → DNC → 再発信 BLOCKED) | NOT IMPLEMENTED (P10/P17)                                | —                                                          |

## Security テスト対応表

| 要件                                                    | 状態                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Invalid input rejected                                  | DONE（HTTP schema → VALIDATION_ERROR、config 検証）                                |
| Unauthenticated call rejected / Tenant isolation / RBAC | DONE (domain guard) / API レベルは P3                                              |
| Forged webhook rejected                                 | NOT IMPLEMENTED (P8/P11)。production で署名検証バイパス不可は DONE（config）       |
| Expired session rejected / Rate limit                   | NOT IMPLEMENTED (P3 / P16)                                                         |
| Prompt injection                                        | PARTIAL: 拒否を含む注入文は停止される（evals/adversarial）。tool policy 評価は P12 |

---

## TDD Strategy（STEP 13, 2026-10-05）

| 層          | ツール                                     | 対象                                                                                    | 方針                                                                    |
| ----------- | ------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Domain unit | Vitest                                     | 状態機械・policy・guard                                                                 | 例示 + 境界値 + 全ペア網羅（遷移表）。**critical mutant smoke 全 kill** |
| Property    | Vitest（P2 で fast-check 導入を ADR 判断） | 電話正規化の冪等性、遷移の閉包、suppression の単調性（エントリ追加で ALLOW が増えない） | 例示テストで漏れる入力空間を補う                                        |
| Integration | Vitest + 実 PostgreSQL 16                  | repository・トランザクション・一意制約・行ロック                                        | モックしない。CI は service container                                   |
| Concurrency | 同上                                       | 同一 key 100 並列 / 同一 contact 異 key 並列 / webhook 重複・順序逆転                   | `Promise.all` で実競合を起こす                                          |
| HTTP        | Fastify `inject`                           | 認証・認可・tenant・validation・エラー形式                                              | 全エンドポイントで 401/403/404(cross-tenant)/400 を最低 1 本            |
| E2E         | Playwright（`/opt/pw-browsers/chromium`）  | Critical journey / DNC journey（Fake telephony）                                        | P10 以降。実電話は使わない                                              |
| AI eval     | `evals/` + runner                          | policy・tool 選択・状態遷移（文言一致ではない）                                         | P12 で LLM 応答評価を追加                                               |
| Load        | k6 または autocannon（ADR で選定）         | 発信 API・webhook 受信・SSE                                                             | P17                                                                     |

### 必須テスト（仕様 25）と配置

| 要件                                             | 層                                       | 状態              |
| ------------------------------------------------ | ---------------------------------------- | ----------------- |
| DNC contact cannot be called                     | domain + HTTP + E2E                      | domain DONE       |
| DNC contact cannot enter queue                   | integration                              | P6                |
| DNC survives retry/restart                       | integration（別プールで再読込）          | P2/P5             |
| Duplicate request does not create duplicate call | concurrency                              | P7                |
| Tenant A cannot read Tenant B                    | HTTP + integration                       | domain DONE / P3  |
| Invalid phone number cannot be called            | domain + HTTP                            | domain DONE       |
| Forbidden call state transition fails            | domain                                   | DONE              |
| Human takeover stops AI                          | domain（会話 controller）+ voice gateway | domain DONE / P13 |
| Duplicate webhook is idempotent                  | integration                              | P8                |
| Out-of-order webhook does not corrupt call state | domain（reconcile）+ integration         | domain DONE / P8  |
| AI cannot bypass suppression                     | domain + evals                           | DONE              |
