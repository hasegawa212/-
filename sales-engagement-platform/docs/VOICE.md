# VOICE

Status: **NOT IMPLEMENTED (P8 Fake / P11 Production telephony / P12 Realtime AI voice)**。

## 公式ドキュメント確認状況（2026-10-05）

開発環境の egress で `platform.openai.com` / `developers.openai.com` / `www.twilio.com` は直接取得不可。**Web 検索に出た公式ページの抜粋のみ**で以下を確認した。P11/P12 着手時に全文で再検証し、ここを更新すること（記憶で SDK メソッドを書かない）。

| 項目                  | 抜粋で確認できた内容                                                                                                                                                                                                                                                                         | 出典                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| OpenAI Realtime + SIP | SIP トランクを `sip:$PROJECT_ID@sip.api.openai.com;transport=tls` に向ける。着信で webhook `realtime.call.incoming`（`webhook-id` / `webhook-timestamp` / `webhook-signature` 付き）。`POST https://api.openai.com/v1/realtime/calls/$CALL_ID/accept` で instructions/voice 等を渡して受ける | developers.openai.com/api/docs/guides/realtime-sip     |
| Twilio Media Streams  | `<Connect><Stream>` で双方向。音声は `audio/x-mulaw` 8000Hz・base64。`clear`（バッファ破棄=割り込み）、`mark`（再生位置通知）、`dtmf`（双方向時のみ、inbound_track）                                                                                                                         | twilio.com/docs/voice/media-streams/websocket-messages |
| 現行 TAC の実装       | Twilio Media Streams ⇄ OpenAI Realtime（g711_ulaw 中継、`speech_started` で `clear` + `response.cancel`）、ConversationRelay、`<Gather>` の 3 方式（`telegram-ai-bot/tac/realtime.py`, `README.md`）                                                                                         | `hasegawa212/-6780`                                    |

**未確認（UNKNOWN）**: OpenAI SIP の発信（dial-out）可否・REFER による転送の正確な仕様・現行モデル名の一覧・料金。→ P12 着手前のスパイクで確認。

## 構成案（PROPOSED）

```mermaid
flowchart LR
  PSTN((PSTN)) <--> TP[Telephony provider<br/>Twilio etc.]
  TP -- "A) SIP trunk" --> OAI[Realtime AI<br/>SIP endpoint]
  TP -- "B) Media stream (WS μ-law)" --> VG[Voice gateway<br/>(our service)]
  VG <--> RT[Realtime AI<br/>WebSocket]
  OAI -- webhook / sideband --> VG
  VG --> TGW[Tool gateway]
  TGW --> APP[Application: contact / calendar / knowledge / follow-up / suppression]
  VG -- call events --> APP
  APP -- takeover / transfer --> TP
```

- **A) SIP 直結**: 遅延最小・音声処理を持たない。会話制御（tool・状態機械）は webhook/sideband 経由。
- **B) Media stream 中継（現行 TAC 方式）**: 我々が音声経路に立つので barge-in・録音可否・強制終話を完全制御できる。代わりに音声サーバの運用・スケールが必要。
- 判断は P12 スパイク後に ADR。**どちらでも** `VoiceAgent` port の裏に隠し、Domain は知らない。

## 音声で扱う事象と方針

| 事象                    | 方針                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| VAD / turn detection    | Provider 側 server VAD を既定。閾値は campaign 設定、評価は evals                             |
| Barge-in / interruption | 顧客発話開始で再生バッファを `clear`、生成を cancel（現行 TAC と同じ）                        |
| 無音                    | N 秒で確認発話、さらに M 秒で丁寧に終話（ENDING）                                             |
| 拒否・DNC               | **AI 応答前**に `handleCustomerTurn` → STOPPING（IMPL）→ suppression 永続化 → 確認発話 → 終話 |
| DTMF                    | 現行 TAC の IVR（1=日程変更 / 2=担当者 / 9=連絡不要）を継承。9 は DO_NOT_CALL                 |
| 留守電                  | AMD 結果で VOICEMAIL。**留守電への営業メッセージは残さない**（既定。〔要法務確認〕）          |
| Human handoff           | `AI_ACTIVE → HUMAN_ACTIVE`。AI 音声を即停止し、Handoff payload を担当者へ                     |
| ネットワーク断          | voice gateway が heartbeat 監視、Call を FAILED に収束、AI セッション破棄                     |
| 最大通話時間            | campaign 設定で強制 ENDING（コスト・安全）                                                    |

## FakeTelephonyProvider（P8）シナリオ

ring / answer / busy / reject / timeout / disconnect / voicemail / provider error / duplicate webhook / delayed webhook / out-of-order event。seed 付きスクリプトで決定的に再現する。

## Feature flags / 安全装置

`AI_VOICE_ENABLED`・`RECORDING_ENABLED`・`HUMAN_HANDOFF_ENABLED`（既定 OFF）。Provider 連続エラーで circuit breaker、AI/電話の予算超過で cost circuit breaker（guard `TELEPHONY` / `BUDGET`）。
