# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Shape

This repo (`hasegawa212/-`) is **not a single application** — it is a loose collection of independent subprojects plus a standalone data file. Each subproject has its own package manifest, dependencies, and run commands. There is no root-level package.json, workspace config, build system, lint config, or test framework. Treat each subdirectory as a self-contained project.

```
/
├── admin-dashboard/          # Standalone Vite + React + TS admin dashboard (wouter, mock data, JP UI)
├── claude-clone/             # Vanilla-JS chat UI + Express proxy to Anthropic API
├── n8n-workflows/            # n8n workflow JSON exports (no code to run)
├── appraisal-app/            # Vite + React + TS appraisal simulator (real estate & car, tested valuation engine, JP UI)
├── ultimate-ai-agent/        # Full-stack TS monorepo (React + Express + tRPC + SQLite)
├── slack-bulk-messaging/     # Zero-dep Node CLI: send individual Slack DMs to a recipient list in bulk (JP UI)
├── echo-interview-console/   # Zero-dep vanilla-JS 反響面談 hearing console → writes a full 53-col row into the Google Sheets ヒアリングシート via Apps Script
└── テレアポ管理シート.csv     # Telemarketing tracking spreadsheet (data only)
```

When the user's request is scoped to one subproject, `cd` into it and follow that subproject's conventions — do not assume tooling from one subproject applies to another (e.g. `claude-clone` is plain JS with no build step; `ultimate-ai-agent` is TypeScript strict mode with Drizzle/tRPC).

## Subprojects

### `appraisal-app/` — 本物査定アプリ (real estate & car appraisal simulator)
Independent Vite + React 18 + TypeScript (strict) app, no backend / no API key. Computes **concrete appraisal estimates from a transparent valuation engine** (not mock numbers) and renders the calculation breakdown. UI copy is Japanese; the price dataset is Ibaraki-focused.

- `cd appraisal-app && npm install && npm run dev` → http://localhost:5175
- `npm run build` (Vite → `dist/`), `npm run typecheck` (`tsc --noEmit`), `npm run test` (**Vitest** — the only subproject with tests).
- The valuation engine lives in `src/lib/valuation/` as pure functions, decoupled from the UI: `realEstate.ts` (land × area × 駅補正 + building × 再調達単価 × 残存率), `car.ts` (新車価格 × 年式残価率 × 走行距離 × メーカー補正 …), with all coefficients/tables in `data.ts` and assertions in `valuation.test.ts`. Add cities to `CITY_LAND_PRICE` or models to `CAR_MODELS` in `data.ts` — no logic change needed.
- UI is Tailwind + small local primitives (`src/components/ui/`); single page (`src/pages/Home.tsx`) toggling 不動産/車 forms. Estimates are 概算 only (disclaimer shown).

### `admin-dashboard/` — Standalone admin dashboard
Independent Vite + React 18 + TypeScript (strict) app whose root is `src/App.tsx` (the structure: `ErrorBoundary` → `ThemeProvider` → `AdminAuthProvider` → `TooltipProvider` → wouter `Router`). Routing is **wouter** (not react-router), UI is Tailwind + shadcn-style primitives (`sonner` toaster, Radix `tooltip`, `button`, `card`). No backend — all dashboard data is mock, and auth is a client-only demo gate (`admin@example.com` / `admin`). All UI copy is Japanese.

- `cd admin-dashboard && npm install && npm run dev` → http://localhost:5174
- `npm run build` (Vite, outputs `dist/`), `npm run typecheck` (`tsc --noEmit`). No tests, no linter.
- Theme default is set via the `defaultTheme` prop on `<ThemeProvider>` in `App.tsx`; light/dark/system persisted to `localStorage`, applied as a `.dark` class.
- Add routes in the `Router` in `App.tsx`; edit KPI/activity mock data at the top of `src/pages/Dashboard.tsx`.

See `admin-dashboard/README.md` (Japanese) for full layout and customization notes.

### `claude-clone/` — Open Clone chat UI
Claude-style chat clone. Frontend is zero-dependency vanilla JS (`index.html`, `styles.css`, `app.js`) that persists conversations to `localStorage`. Backend is a thin Express proxy (`server.js`) that forwards `/api/chat` requests to the Anthropic SDK.

- Run with real LLM: `cd claude-clone && cp .env.example .env` (set `ANTHROPIC_API_KEY`), then `npm install && npm start` → http://localhost:8787
- Run as static offline demo (no key, dummy replies): `python3 -m http.server --directory claude-clone 8000`
- Dev with auto-reload: `npm run dev` (uses `node --watch`)
- Model selector values `clone-opus` / `clone-sonnet` / `clone-haiku` map to real model IDs via `MODEL_MAP` in `server.js:15`. Add new models in **both** that map and the `<select>` in `index.html`.
- ES Modules (`"type": "module"`). No tests, no linter, no build step.
- Frontend detects backend availability by calling `/api/health` and falls back to a local dummy generator if no key is configured — preserve this dual-mode behavior when editing `app.js`.

See `claude-clone/README.md` (Japanese) for endpoint details and customization hints (streaming, auth, persistence).

### `ultimate-ai-agent/` — Full-stack AI agent platform
TypeScript monorepo: React/Vite client, Express/tRPC server, SQLite via Drizzle ORM, OpenAI SDK. **Authoritative documentation lives in `ultimate-ai-agent/CLAUDE.md`** — read it before making changes here; it covers the tRPC router layout, Drizzle schema (6 tables), shared-types path aliases, WebSocket/SSE patterns, Docker setup, and per-task file maps.

Quick reference (full detail in the subproject's CLAUDE.md):
- `cd ultimate-ai-agent && npm install` (then also `npm install` in `client/` and `server/`)
- `npm run dev` runs server (port 3000, tsx watch) and client (Vite, port 5173) concurrently
- `npm run db:push` to apply `drizzle/schema.ts` changes; integer-stored temperatures are converted to floats at the API layer
- Strict TS, Zod at boundaries, ES Modules, `gpt-4o-mini` as default model. No linter or tests configured.

### `slack-bulk-messaging/` — 個別DM一斉送信CLI
Zero-dependency Node ES Modules CLI (`send.js`, Node 18+ global `fetch` only) that sends **individual 1:1 Slack DMs** to every recipient in a list — not a group DM — so each person feels personally addressed. Recipients are given by CSV with either an `email` column (resolved via `users.lookupByEmail`) or a `slack_id` column (`slack_id` wins if both present); other columns feed `{{column}}` template substitution in the message body. Flow per recipient: resolve user ID → `conversations.open` → `chat.postMessage`, with 1s default `--delay`, automatic 429 retry, and a per-run `send-log-*.csv`.

- `cd slack-bulk-messaging && cp .env.example .env` (set `SLACK_BOT_TOKEN`, `xoxb-...`)
- Always preview first: `node send.js -r recipients.csv -m message.txt --dry-run` (with no token, email recipients show a `email:...` placeholder and no network call is made)
- Send for real: `node send.js -r recipients.csv -m message.txt [--delay 1500]`
- No build/test/lint. Required Bot scopes: `chat:write`, `im:write`, and `users:read.email` for email recipients.
- `.gitignore` excludes `recipients.csv` / `message.txt` / `send-log-*.csv` (PII) — only `*.example.*` files are tracked. See `slack-bulk-messaging/README.md` (Japanese) for the full setup.

### `echo-interview-console/` — 反響面談コンソール (hearing console → ヒアリングシート)
Zero-dependency vanilla-JS console (ES Modules, no build step — like `claude-clone`) used during 反響/online 面談 for 株式会社 Martial Arts. Operators fill the hearing form and on save it writes **one row covering every field (the existing 53 columns A–BA)** into a `ヒアリングシート①/②/③` tab of the Google Sheet `⭐️反響管理シート（martialhp連動）`. Solves the "ちゃんと反映されない" gap where the deployed Replit console only populated a few of the sheet's 53 columns.

- Run: `cd echo-interview-console && python3 -m http.server 5180` → http://localhost:5180 (no install/build).
- **`fields.js` is the single source of truth** mapping each input ↔ sheet column (`col`). The 7 form sections mirror the Slack 「反響顧客ヒアリングサマリー」 headings. The sheet is fixed at 53 columns (A–BA, headers on row 25), so the 4 qualitative fields with no dedicated column (エリア理由/絶対条件/希望条件/将来像) carry a `mergeInto: 'AY'` instead and are folded into 備考(AY) as `【ラベル】値` at save time — the sheet is never structurally widened.
- Writes go through `apps-script/Code.gs` (Google Apps Script Web App, `doPost`): it ensures the row-25 headers, finds the next empty data row (≥26, keyed on お客様名/E), and writes each value by column letter; `保存日時`(AZ) + `閲覧URL`(BA) are auto-set. The browser POSTs as `text/plain` to avoid CORS preflight. The Web App URL is configured in the console's ⚙︎ 設定 (stored in localStorage).
- If you change `FIELDS`, also update `HEADERS` in `Code.gs` and the spreadsheet's row-25 headers. No tests/lint/build. See `echo-interview-console/README.md` (Japanese) for deploy steps.

### `n8n-workflows/` — n8n workflow exports
Contains `telegram-to-sheets-slack.json`, an importable n8n workflow (Telegram trigger → Google Sheets append → Slack notify → Telegram ack). Not executable code — it is imported via the n8n UI. Before reuse, the consumer must replace placeholders in the JSON: `REPLACE_WITH_TELEGRAM_CREDENTIAL_ID`, `REPLACE_WITH_GOOGLE_SHEET_ID`, `REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID`, `REPLACE_WITH_SLACK_CHANNEL_ID`, `REPLACE_WITH_SLACK_CREDENTIAL_ID`. Setup details and Google Sheets header schema (`timestamp | chat_id | chat_title | user_id | username | text | message_id`) are in `n8n-workflows/README.md` (Japanese).

### `テレアポ管理シート.csv`
Japanese telemarketing call-management spreadsheet (24 columns: 優先度, 架電ステータス, contact info, 年収/勤続年数/貯蓄額, 架電日1–3, アポ日時, 担当者, 備考…). UTF-8 with BOM, contains real-looking PII — do not commit derivative files that expose this data, and do not paste rows into external services.

## Git / Branch Conventions

- Default working branch for documentation tasks here is `claude/add-claude-documentation-ElzXV` (see task instructions). Develop, commit, and push to the branch specified for the current task; never push to `main` directly.
- Commit history shows English `feat:` / `Add ...` style messages plus occasional Japanese subjects — match the style of the file being changed (English for `claude-clone` README is in Japanese but commit messages have been English; subproject precedent wins).
- The repo name is the single character `-`, so the working directory is `/home/user/-`. Avoid shell constructs that interpret a bare `-` as stdin (`cd "$REPO"` is fine, `cd -` is not).

## Working Across Subprojects

- A change is rarely cross-cutting. If a task mentions e.g. "the chat app" without context, ask which subproject — `claude-clone` (Anthropic-backed clone) and `ultimate-ai-agent` (OpenAI-backed platform) are both plausible referents.
- Do not introduce a root-level `package.json`, workspace, or shared tooling unless the user explicitly asks for it; the subprojects are deliberately independent.
