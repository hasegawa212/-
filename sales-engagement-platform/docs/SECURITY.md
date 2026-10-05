# SECURITY

## 実装済み（Phase 0–1）

| 対策                 | 実装                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 秘密値の分離         | `toClientSafeConfig` は allow-list 投影。secret / DB URL はブラウザに出ない                                                          |
| 設定 fail-fast       | 不正 env で起動拒否。エラーメッセージはキー名のみ（値を出さない）                                                                    |
| production 保護      | `WEBHOOK_SIGNATURE_BYPASS=true` / 弱い `SESSION_SECRET`(<32) / `AUTO_DIAL_ENABLED=true` は起動拒否                                   |
| ログ PII             | 電話番号は末尾 4 桁、email / token / password / authorization / transcript は値ごと除去（構造化フィールド + メッセージ文字列の両方） |
| ログインジェクション | `x-request-id` は `[A-Za-z0-9._-]{8,128}` のみ採用、それ以外は UUID を新規発行                                                       |
| エラー情報漏洩       | 想定外例外は `INTERNAL_ERROR` 固定文言。スタック・内部メッセージは返さない                                                           |
| Tenant isolation     | Guard で actor / contact / campaign の organizationId 一致を強制。不一致は NOT_FOUND                                                 |
| AI 権限              | AI_AGENT actor は発信不可（権限に関係なく）                                                                                          |
| 依存監査             | CI で `npm audit --omit=dev --audit-level=high`                                                                                      |

## 未実装（Phase で予定）

- P3: 認証（セッション / 有効期限 / CSRF）、RBAC の API 適用、監査ログ。
- P8/P11: Webhook 署名検証（Provider 公式仕様で実装、テストのみ fake signature）。
- P12: AI tool allowlist + input schema 検証 + tool output の sanitize（AI_AGENT.md）。
- P16: rate limit、セキュリティヘッダ、SAST、secret scanning、ペネトレーション観点レビュー。

## 禁止事項

本番 API key のハードコード / webhook 署名検証の本番無効化 / DNC・RBAC・tenant isolation の回避 / 実顧客へのテスト発信。

## 脆弱性報告

リポジトリ管理者（株式会社 Martial Arts）へ非公開で連絡する。公開 Issue に PII や秘密値を書かない。

---

## Threat Model（STEP 12, STRIDE, 2026-10-05）

信頼境界: ①ブラウザ ↔ API ②Telephony provider ↔ webhook ③音声/AI provider ↔ voice gateway ④AI ↔ tool gateway ⑤アプリ ↔ PostgreSQL ⑥取込データ（CSV/Slack/Drive 等）。

| #   | 脅威 (STRIDE)                                         | 境界 | 現行 TAC で観察した形                                     | 対策                                                                                             | 状態             |
| --- | ----------------------------------------------------- | ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| T1  | **S**poofing: 共有トークン漏洩で誰でも発信            | ①    | 全操作者が `X-TAC-Token` 1 本を共有、localStorage 保存    | 個人アカウント + HttpOnly セッション + RBAC、操作者ごとの監査                                    | P3               |
| T2  | **S**: 偽 webhook で通話状態・結果を改ざん            | ②    | `TAC_VERIFY_TWILIO_SIGNATURE` は env で ON/OFF 可         | 署名検証必須（production で無効化不可は DONE）、timestamp 許容幅、`(provider,event_id)` 重複排除 | config DONE / P8 |
| T3  | **T**ampering: DNC を外す・分類を書き換える           | ①    | 「分類を修正」「連絡停止」が共有トークンで誰でも可        | 解除は権限＋理由必須・監査、hard suppression は削除でなく失効記録                                | P5               |
| T4  | **R**epudiation: 誰が発信/拒否登録したか不明          | ①    | 担当者は自由入力/選択、actor 不明                         | AuditLog（actor・requestId・before/after）                                                       | P3               |
| T5  | **I**nformation disclosure: ログ・画面からの PII 漏洩 | 全   | 電話番号が記録タブに全桁表示                              | redaction（DONE）、画面は権限で全桁/マスク切替、エクスポートは権限＋監査                         | 部分 DONE        |
| T6  | **I**: Tenant 間漏洩                                  | ①⑤   | 単一テナント前提                                          | guard TENANT（DONE）+ repo 層で org_id 必須 + 統合テスト（Tenant A→B 不可）+ RLS 検討            | P2/P3            |
| T7  | **D**oS / コスト暴走: 連続発信・AI 従量課金           | ①③   | 「連続で自動発信（止まらない）」「無人オート運転」        | kill switch（DONE）、日次上限・同時数・予算 guard（DONE）、circuit breaker、レート制限           | 部分 DONE        |
| T8  | **E**levation: AI が任意番号に発信・DB 操作           | ④    | AI tool は `escalate_to_human`/`schedule_callback` 程度   | AI_AGENT は発信不可（DONE）、tool allowlist・セッション束縛・schema 検証                         | 部分 DONE / P12  |
| T9  | Prompt injection（顧客発話・メモ・取込データ）        | ③④⑥  | Slack/Drive 記録を AI 分類                                | L1 で data/instruction 分離、tool は引数束縛、出力 sanitize、adversarial evals                   | 部分 DONE        |
| T10 | XSS / CSRF                                            | ①    | textContent 使用（良い）、CSRF は token header で実質防御 | CSP（nonce）、cookie セッション時は CSRF token、出力エンコード                                   | P9/P16           |
| T11 | SSRF（通知 webhook URL 等）                           | ⑥    | `TAC_NOTIFY_WEBHOOK` へ POST                              | 送信先 allowlist、内部アドレス拒否                                                               | P16              |
| T12 | 秘密情報の混入                                        | 全   | README に「チャットに出た鍵はローテーション」             | secret は env/secret manager のみ、client-safe 投影（DONE）、secret scanning                     | 部分 DONE        |
| T13 | データ破損・消失                                      | ⑤    | JSONL/JSON ファイル（単一マシン・ボリューム）             | PostgreSQL + migration + バックアップ/PITR                                                       | P2/P18           |

OWASP ASVS: P16 で最新版の要件（認証・セッション・アクセス制御・入力検証・ログ）に対するチェックリストを作成する（最新版番号は着手時に公式で確認）。
