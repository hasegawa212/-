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
