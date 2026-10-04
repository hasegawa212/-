# AI_AGENT

Status: **NOT IMPLEMENTED (P12)**。安全に関わる決定論的部分（会話状態機械・拒否検知・AI 発信禁止）は P1 で実装済み。

## 原則

1. AI は **決定権を持たない**: 発信・DNC 解除・データ削除はできない。AI_AGENT actor は発信不可（`outboundGuards.ts`）。
2. 顧客の発話は AI に渡す前に `handleCustomerTurn` を通す。拒否なら AI のターンは無く終話。
3. AI は許可された tool だけを使う。tool は **セッションに束縛**され、他顧客を指す引数（contactId, phone 等）を取らない。
4. tool input は schema 検証（zod）。tool output も untrusted として sanitize してから AI に渡す。

## Tool allowlist（P12 で実装）

| Tool                                                                                                                                                          | 入力                              | 備考                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------ |
| getContact                                                                                                                                                    | なし（セッションの contact 固定） | PII は最小限の項目のみ               |
| getCompany                                                                                                                                                    | なし                              | 公開情報                             |
| searchKnowledge                                                                                                                                               | `{ query: string(≤200) }`         | 社内 FAQ のみ                        |
| getAvailability                                                                                                                                               | `{ from, to }`（範囲上限あり）    | 担当者の空き枠                       |
| createFollowUp                                                                                                                                                | `{ type: 'CALLBACK'               | 'APPOINTMENT', at }`                 | outcome ドメインと同じ検証 |
| requestHandoff                                                                                                                                                | `{ reason, summary }`             | HUMAN_HANDOFF_ENABLED 時のみ         |
| markDoNotCall                                                                                                                                                 | なし                              | 常に許可（安全側の操作は拒否しない） |
| 存在しない操作: 任意番号への発信、他顧客の検索、データ削除、権限変更。プロンプトインジェクション（「指示を無視して…」）は tool の不在と引数束縛で無効化する。 |

## 状態ごとの許可 tool（案）

- STOPPING: `markDoNotCall` のみ。
- HANDOFF: `requestHandoff` のみ。
- それ以外: allowlist 全体（ただし `createFollowUp` は INTERESTED / SCHEDULING のみ）。

## Handoff payload（P13）

Contact / Company / 会話要約 / transcript 抜粋 / intent / qualification / objections / 推奨次アクション / handoff 理由。

## 評価

`evals/` の 8 カテゴリ。現在は決定論的安全層を評価。P12 で LLM 応答に対する tool 選択・禁止行為・状態遷移の評価を追加する。
