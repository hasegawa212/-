# PROGRESS

> 実装状態の Single Source of Truth。作業再開時は必ず最初に読む。
> ステータス語彙: DONE / IN PROGRESS / PARTIAL / BLOCKED / NOT IMPLEMENTED / MOCK ONLY。

# Current Phase

Phase 2 - Database (NOT STARTED — spec in IMPLEMENTATION_PLAN.md)

# Completed

- Phase 0 Foundation — DONE
  - tooling: TS strict / ESLint strictTypeChecked + layer boundary rule / Prettier / Vitest (shuffle) + coverage gate / build
  - config + feature flags (zod, fail-fast, flags default OFF, kill switch default ENGAGED, prod guards)
  - error taxonomy + retryable classification
  - PII-safe logging (redact + pino hooks)
  - HTTP: /health, /config (client-safe), x-request-id, error envelope
  - CI: `.github/workflows/sales-engagement-platform.yml`
- Phase 1 Domain — DONE (pure domain only; nothing persisted yet)
  - phone normalization (JP → E.164)
  - suppression policy (DNC, fail closed, no override path)
  - calling window (TZ / weekday / holiday / contact preference)
  - call state machine
  - outbound guard pipeline (14 guards, fail closed, ADR-0008 ordering)
  - outcome → follow-up / suppression (再勧誘禁止)
  - conversation state machine + stop-intent detection
  - evals/ dataset (8 categories, 35 cases) for the deterministic safety layer
  - critical mutant smoke (19/19 killed)

# In Progress

- none

# Blocked

- Reference app `https://tac-martial-arts.fly.dev/tac/app` unreachable from the dev environment (egress blocked) — ADR-0002. Product understanding derived from in-repo artifacts; open questions listed in PRODUCT.md.

# Next

1. Phase 2 Database (migrations, repositories, idempotency table, outbox, concurrency tests on real PostgreSQL)
2. Phase 3 Auth / Tenant / RBAC
3. Phase 4 Contacts (CSV import compatible with テレアポ管理シート.csv)

# Known Issues / Deviations

- logger.ts was implemented before its test (TDD deviation). Compensated with an end-to-end test and a manual mutation check.
- evals/ were written after the conversation module (they are an evaluation dataset, not TDD drivers).
- Coverage: remaining uncovered branches are unreachable defensive fallbacks (e.g. `?? ''` on Intl parts, phone presence checks after PHONE guard).
- 〔要法務確認〕 items in COMPLIANCE.md (calling hours, treating 「興味なし」 as re-solicitation refusal, AI disclosure, recording notice).
- DNC requirements that need persistence/queue/webhooks are NOT IMPLEMENTED yet — see TESTING.md table.

# TDD Evidence (RED → GREEN)

| Module           | RED observed                                                                           | GREEN                                     |
| ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| errors           | module missing                                                                         | 13 tests                                  |
| config           | module missing                                                                         | 11                                        |
| redact           | module missing                                                                         | 16 (+regression: row number before phone) |
| http app         | module missing                                                                         | 11                                        |
| phoneNumber      | module missing                                                                         | 32                                        |
| suppression      | module missing                                                                         | 19                                        |
| callingWindow    | module missing                                                                         | 25                                        |
| callStateMachine | module missing                                                                         | 9                                         |
| outboundGuards   | module missing                                                                         | 35                                        |
| outcome          | module missing                                                                         | 23                                        |
| conversation     | module missing; then 1 assertion RED (half-width ｹｯｺｳﾃﾞｽ false negative) fixed in impl | 41                                        |
| mutation smoke   | 2 surviving mutants → tests strengthened                                               | 19/19                                     |

# Last Verified (2026-10-04)

- format: PASS / lint: PASS / typecheck: PASS / unit+integration: PASS / coverage gate: PASS / build: PASS / mutation smoke: PASS
- start: `node dist/main.js` → GET /health 200
- E2E: NOT IMPLEMENTED (no UI yet)
