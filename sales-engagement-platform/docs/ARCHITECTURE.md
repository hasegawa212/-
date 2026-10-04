# ARCHITECTURE

## 方針

**Modular monolith**（1 デプロイ単位）+ 厳格なレイヤ分離。外部 Provider 境界（Telephony / AI / Storage / Email / Calendar）のみ抽象化し、それ以外の将来用抽象化は作らない。

```text
Interface      src/interface/   HTTP (Fastify), webhooks, (P9) UI
   ↓ depends on
Infrastructure src/infrastructure/  config, logging, (P2) Postgres repos, (P8/11) telephony adapters, (P12) AI adapters
   ↓
Application    src/application/  (P2+) use cases: gather facts → call domain → persist (+ outbox) in one transaction
   ↓
Domain         src/domain/       pure functions & types, no I/O, no framework (ESLint-enforced, ADR-0006)
```

## 現在のモジュール（Phase 0–1）

| Path                                  | 役割                                             |
| ------------------------------------- | ------------------------------------------------ |
| `domain/errors.ts`                    | Error taxonomy + retryable 分類                  |
| `domain/contact/phoneNumber.ts`       | 日本の電話番号 → E.164（DNC 照合キー）           |
| `domain/suppression/suppression.ts`   | DNC 等の suppression 判定（fail closed）         |
| `domain/compliance/callingWindow.ts`  | 発信可能時間帯（TZ・曜日・祝日・顧客希望）       |
| `domain/call/callStateMachine.ts`     | Call 状態機械                                    |
| `domain/outbound/outboundGuards.ts`   | 発信前 Guard Pipeline                            |
| `domain/outcome/outcome.ts`           | 通話結果 → Follow-up / Suppression               |
| `domain/conversation/conversation.ts` | AI 会話状態機械 + 拒否意図検知                   |
| `infrastructure/config.ts`            | env 検証・feature flags・client-safe 投影        |
| `infrastructure/logging/*`            | PII redaction 付き pino                          |
| `interface/http/app.ts`               | `/health`, `/config`, request id, error envelope |

## 発信フロー（P7 で実装予定の application 層の形）

```text
POST /calls (Idempotency-Key)
  └─ tx BEGIN
      ├─ idempotency key を INSERT … ON CONFLICT で予約（NEW / REPLAY / IN_FLIGHT / PAYLOAD_MISMATCH）
      ├─ contact / campaign / suppression / counters を SELECT … FOR UPDATE（contact 行ロックで二重発信防止）
      ├─ evaluateOutboundGuards(ctx)  ← Domain（純関数）
      ├─ ALLOW → call(QUEUED) INSERT + outbox(call.requested) INSERT
      └─ tx COMMIT
  outbox worker → TelephonyGateway.startCall()（Provider 呼び出しは tx の外。at-least-once + provider 側 idempotency）
```

- **Outbox pattern を採用予定**（ADR は P2 で確定）: DB 更新と外部発信の不整合（発信したのに記録が無い / 記録したのに発信しない）を防ぐ。
- Provider webhook は (provider, event id) で重複排除し、`transitionCall` で順序外れを INVALID_STATE_TRANSITION として吸収（no-op 記録）。

## Provider Adapter 境界（P8 / P11 / P12）

```ts
interface TelephonyGateway {
  startCall(input: StartCallInput): Promise<CallHandle>;
  transferCall(input: TransferCallInput): Promise<void>;
  endCall(input: EndCallInput): Promise<void>;
}
interface VoiceAgent {
  startSession(input: StartSessionInput): Promise<SessionHandle>;
  sendContext(input: SendContextInput): Promise<void>;
  requestHandoff(input: HandoffInput): Promise<void>;
  endSession(input: EndSessionInput): Promise<void>;
}
```

Domain は Provider 名・モデル名を知らない。Production adapter は公式ドキュメントの最新版を確認してから実装する（SDK メソッドを記憶で書かない）。

## Realtime

Call の realtime 状態は SSE を第一候補（一方向・HTTP/プロキシ互換・再接続容易）。双方向音声は Provider 側（SIP/WebRTC）に閉じる。P9 で ADR 化。
