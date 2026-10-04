# sales-engagement-platform

次世代 TAC テレアポ ― **AI + Human Hybrid Sales Engagement Platform**（株式会社 Martial Arts）。

> 現在の状態: **Phase 0 (Foundation) + Phase 1 (Domain) 完了**。DB・API（発信）・UI・電話/AI Provider は未実装。
> 実装状態は必ず [`docs/PROGRESS.md`](docs/PROGRESS.md) を参照。

## Quick start

```bash
cd sales-engagement-platform
npm ci
npm run verify          # format → lint → typecheck → test (coverage gate) → build
npm run test:mutation   # 安全系 domain の critical mutant smoke
npm run dev             # http://localhost:8080/health
```

## 安全上の既定値

| 設定                                                               | 既定               | 備考                                      |
| ------------------------------------------------------------------ | ------------------ | ----------------------------------------- |
| `OUTBOUND_KILL_SWITCH`                                             | `true`（発信停止） | 明示的に `false` にしない限り発信しない   |
| `AUTO_DIAL_ENABLED`                                                | `false`            | production では P6 まで `true` で起動拒否 |
| `AI_VOICE_ENABLED` / `RECORDING_ENABLED` / `HUMAN_HANDOFF_ENABLED` | `false`            |                                           |
| `WEBHOOK_SIGNATURE_BYPASS`                                         | `false`            | production で `true` は起動拒否           |

その他の env: `NODE_ENV`(development/test/production), `PORT`(8080), `LOG_LEVEL`, `TZ_DEFAULT`(Asia/Tokyo), `DATABASE_URL`, `SESSION_SECRET`(production は 32 文字以上必須)。

## ドキュメント

|                                                                                              |                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [PRODUCT](docs/PRODUCT.md)                                                                   | 既存業務の理解と写像、要確認事項           |
| [ARCHITECTURE](docs/ARCHITECTURE.md)                                                         | レイヤ・発信フロー・Provider 境界          |
| [DOMAIN](docs/DOMAIN.md)                                                                     | 業務ルール（DNC・時間帯・状態機械・Guard） |
| [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md)                                           | Task Graph と Phase 仕様                   |
| [PROGRESS](docs/PROGRESS.md)                                                                 | 実装状態（SSOT）                           |
| [TESTING](docs/TESTING.md) / [SECURITY](docs/SECURITY.md) / [COMPLIANCE](docs/COMPLIANCE.md) |                                            |
| [VOICE](docs/VOICE.md) / [AI_AGENT](docs/AI_AGENT.md)                                        | P8–P13 の設計                              |
| [DECISIONS](docs/DECISIONS.md)                                                               | ADR                                        |
