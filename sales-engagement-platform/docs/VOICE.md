# VOICE

Status: **NOT IMPLEMENTED (P8 Mock / P11 Production telephony / P12 Realtime AI voice)**。

## 前提（実装前に必須）

- Telephony Provider / OpenAI Realtime（SIP / WebRTC / WebSocket、認証方式、モデル名）は **実装時点の公式ドキュメントを確認してから** adapter を書く。記憶で SDK メソッドを書かない。
- Domain は Provider を知らない（`TelephonyGateway` / `VoiceAgent` interface、ARCHITECTURE.md）。

## FakeTelephonyProvider（P8）が再現すべきシナリオ

ring / answer / busy / reject / timeout / disconnect / voicemail / provider error / duplicate webhook / delayed webhook / out-of-order event。
すべて決定的（seed / script 指定）に再現可能にし、Call 状態機械と webhook 重複排除のテストに使う。

## Feature flags

`AI_VOICE_ENABLED`（既定 OFF）、`RECORDING_ENABLED`（既定 OFF）、`HUMAN_HANDOFF_ENABLED`（既定 OFF）。

## Circuit breaker（P11）

Provider エラーが連続したら新規発信を止める（Guard の `TELEPHONY` に `telephonyAvailable=false` を供給）。コスト急増時の cost circuit breaker は `BUDGET` guard と組み合わせる。
