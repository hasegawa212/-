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

`scripts/mutation-smoke.mjs` が安全上重要な 19 個の変異（DNC 判定反転、fail-open、kill switch 無視、AI 発信許可、終端状態の再開、停止後の説得、開示スキップ、再勧誘…）を 1 つずつ適用し、domain テストが **必ず失敗する** ことを確認する。
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
