# DOMAIN

Domain は純関数のみ。期待される業務上の失敗は `Result`/判定値で返し、不変条件違反だけを `DomainError` で投げる。

## 優先順位（すべての判断に適用）

```text
Safety state (LEGAL_BLOCK > PRIVACY_BLOCK > DO_NOT_CALL > STOP_REQUESTED)
  > Compliance (calling window, consent, disclosure)
  > Operational limits (campaign, budget, concurrency, kill switch, provider)
  > Conversion
```

## 電話番号（`contact/phoneNumber.ts`）

- 入力揺れ（全角・ハイフン・括弧・空白・`+81`・`+81(0)`）→ **E.164 一意**。E.164 が dedupe / DNC 照合のキー。
- 携帯 `060/070/080/090` と IP `050` は 11 桁、固定は 10 桁。
- 発信対象外: `0120 / 0800 / 0570 / 0990 / 0180 / 020`、国外番号、`00` 国際プレフィックス。

## Suppression（`suppression/suppression.ts`）

| reason                                                     | 強さ         | 範囲             | 期限                                 |
| ---------------------------------------------------------- | ------------ | ---------------- | ------------------------------------ |
| LEGAL_BLOCK / PRIVACY_BLOCK / DO_NOT_CALL / STOP_REQUESTED | hard (BLOCK) | 常に組織全体     | **無期限**（expiresAt を無視）       |
| COOLDOWN                                                   | soft (BLOCK) | campaign or 組織 | expiresAt で失効（未設定は有効扱い） |
| HUMAN_REQUIRED                                             | HUMAN_REVIEW | 組織             | —                                    |

- lookup 失敗 = `SUPPRESSION_UNAVAILABLE` で BLOCK。未知 reason / 不正形状 = `SUPPRESSION_DATA_INVALID` で BLOCK。
- **override 引数は存在しない**。hard block を解除できるのは P5 の「権限 + 監査付きの suppression 削除」だけ。

## 発信可能時間（`compliance/callingWindow.ts`）

- 組織ポリシー（既定 Asia/Tokyo 09:00–20:00, 月–土, 祝日リスト）× 顧客希望時間帯の **AND**。顧客希望は狭めるだけで広げない。
- ポリシー不正・未知 TZ は `POLICY_INVALID` で全拒否。顧客希望の文字列が解釈不能なら希望は無視（組織ポリシーは適用）。

## Call 状態機械（`call/callStateMachine.ts`）

```text
QUEUED → DIALING → RINGING → ANSWERED → AI_ACTIVE → HUMAN_ACTIVE → ENDING → COMPLETED
   └→ CANCELLED   └→ ANSWERED  └→ FAILED/CANCELLED   └→ HUMAN_ACTIVE / ENDING / FAILED
```

- 終端: COMPLETED / FAILED / CANCELLED（どこにも遷移不可）。自己遷移は不可（重複イベントは上位で no-op）。
- `HUMAN_ACTIVE → AI_ACTIVE` 不可（人の引き継ぎは確定）。遷移ごとに `version + 1`（楽観ロック用）。

## 発信前 Guard Pipeline（`outbound/outboundGuards.ts`）

```text
AUTHENTICATION → AUTHORIZATION → TENANT → IDEMPOTENCY → KILL_SWITCH → CONTACT → PHONE
→ SUPPRESSION → CONSENT → CALLING_WINDOW → CAMPAIGN_LIMITS → BUDGET → CONCURRENCY → TELEPHONY
```

- 最初の失敗で停止し、通過した guard の `trace` を返す（監査ログ用）。guard が例外を投げたら `INTERNAL_ERROR/GUARD_ERROR` で DENY。
- `AI_AGENT` actor は権限に関係なく発信不可。cross-tenant は `NOT_FOUND`（存在を漏らさない）。
- IDEMPOTENCY を TENANT 直後に置く理由は ADR-0008。REPLAY は発信しない。
- 予算不明（null）は DENY。concurrency は「同一 contact の通話中」を CONFLICT で拒否（二重発信防止の domain 側ルール。DB 側ロックは P6/P7）。

## Outcome → Follow-up（`outcome/outcome.ts`）

| Outcome                           | Suppression                   | Follow-up                              |
| --------------------------------- | ----------------------------- | -------------------------------------- |
| APPOINTMENT_SET                   | —                             | APPOINTMENT @appointmentAt（未来必須） |
| CALLBACK_REQUESTED                | —                             | CALLBACK @callbackAt（未来必須）       |
| NOT_REACHED_NO_ANSWER / VOICEMAIL | —                             | RETRY +24h（上限到達で無し）           |
| NOT_REACHED_BUSY                  | —                             | RETRY +30min（同上）                   |
| NOT_INTERESTED                    | STOP_REQUESTED                | 無し                                   |
| REFUSED_DO_NOT_CALL               | DO_NOT_CALL                   | 無し                                   |
| WRONG_NUMBER                      | PRIVACY_BLOCK（第三者の番号） | DATA_FIX（社内タスク）                 |
| CONVERSATION_ENDED_NO_RESULT      | —                             | 無し                                   |

- 既存 hard suppression があれば営業 follow-up は作らない（DATA_FIX のみ可）。
- outcome は COMPLETED / FAILED の call にだけ、1 回だけ記録可能。FAILED は NOT_REACHED_* のみ。

## AI 会話状態機械（`conversation/conversation.ts`）

```text
INTRODUCTION → DISCLOSURE → IDENTIFICATION → {QUALIFICATION, DISCOVERY, FAQ, OBJECTION, INTERESTED} → SCHEDULING
任意の進行中状態 → HANDOFF | STOPPING | COMPLETED
HANDOFF → STOPPING | COMPLETED,   STOPPING → COMPLETED のみ
```

- DISCLOSURE（商号・氏名・勧誘目的の告知）を経ずに営業状態へ入れない。
- `handleCustomerTurn` は **AI が応答する前に** 毎発話で実行。拒否検知で STOPPING を強制し、
  `PERSIST_SUPPRESSION → CONFIRM_STOP → END_CALL` を指示。AI に説得のターンは渡らない。
- 拒否検知は過検知を許容（false positive = 1 会話の終了、false negative = 拒否者への勧誘継続）。
  「〜で結構です」（肯定）は除外。
