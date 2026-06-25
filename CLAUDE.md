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
├── meeting-feedback-slack/   # Zero-dep Node CLI: send per-person meeting feedback (発言量・参加度 + 次回アクション) as individual Slack DMs (JP UI)
├── echo-interview-console/   # Zero-dep vanilla-JS 反響面談 hearing console → writes a full 53-col row into the Google Sheets ヒアリングシート via Apps Script
├── construction-book/        # Zero-dep single-HTML 施工記録ブック (construction record book) builder for 株式会社 Martial Arts → A4 print/PDF, localStorage (JP UI)
├── construction-portfolio/   # Zero-dep single-HTML 施工事例パンフレット「WORKS」 for 株式会社 Martial Arts → premium A4 brochure, in-browser editable (contenteditable + click-to-replace photos), print/PDF (JP UI)
├── japan-mgmt-line-bot/      # Node + Express LINE Messaging API webhook: rule-based FAQ bot for 株式会社ジャパンマネジメント (JP UI, no AI)
├── financial-literacy-line-bot/ # Node + Express LINE webhook: rule-based 金融リテラシー FAQ bot for 株式会社ジャパンマネジメント (follows fp repo topics, JP UI, no AI)
├── render.yaml              # Render Blueprint deploying financial-literacy-line-bot (the only root-level config; secrets via Render env, sync:false)
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

### `meeting-feedback-slack/` — 会議フィードバック個別DM CLI
Zero-dependency Node ES Modules CLI (`send-feedback.js`, Node 18+ global `fetch` only) that sends **per-person meeting feedback** as individual 1:1 Slack DMs. Same build/plumbing as `slack-bulk-messaging` (CSV parse, `.env` loader, `conversations.open` → `chat.postMessage`, 429 retry, per-run log), but the content differs per recipient and is **structured around two axes the user cares about: 発言量・参加度 (participation) and 次回アクション (next action)** — embodying the rule 「会議は意見交換の場、黙っているのはNG」.

- `cd meeting-feedback-slack && cp .env.example .env` (set `SLACK_BOT_TOKEN`, `xoxb-...`).
- Preview first: `node send-feedback.js -p participants.csv --dry-run` (no token needed; email recipients show an `email:...` placeholder). Send: `node send-feedback.js -p participants.csv [--delay 1500]`.
- **Per-person CSV** (1 row = 1 person): `email`/`slack_id` (slack_id wins) + optional `name`/`会議名`/`日付`/`発言回数`/`良かった点`/`改善点`/`次回アクション`/`一言`. `buildFeedbackMessage()` auto-composes the DM; `participationComment()` turns `発言回数` into a graded nudge (0 → strong "次回は必ず発言" push, `< --low` (default 3) → "もう一歩", ≥ → praise). 次回アクション is always included (defaults to "最低1回は意見を出す" if blank).
- `--template tmpl.txt` switches to `{{列}}` substitution incl. computed `{{発言コメント}}`. No build/test/lint. Required Bot scopes: `chat:write`, `im:write`, plus `users:read.email` for email recipients. `.env`/`participants.csv`/`feedback-log-*.csv`/`template.txt` are gitignored (PII) — only `*.example.*` tracked. See `meeting-feedback-slack/README.md` (Japanese).

### `echo-interview-console/` — 反響面談コンソール (hearing console → ヒアリングシート)
Zero-dependency vanilla-JS console (ES Modules, no build step — like `claude-clone`) used during 反響/online 面談 for 株式会社 Martial Arts. Operators fill the hearing form and on save it writes **one row covering every field (the existing 53 columns A–BA)** into a `ヒアリングシート①/②/③` tab of the Google Sheet `⭐️反響管理シート（martialhp連動）`. Solves the "ちゃんと反映されない" gap where the deployed Replit console only populated a few of the sheet's 53 columns.

- Run: `cd echo-interview-console && python3 -m http.server 5180` → http://localhost:5180 (no install/build).
- **`fields.js` is the single source of truth** mapping each input ↔ sheet column (`col`). The 7 form sections mirror the Slack 「反響顧客ヒアリングサマリー」 headings. The sheet is fixed at 53 columns (A–BA, headers on row 25), so the 4 qualitative fields with no dedicated column (エリア理由/絶対条件/希望条件/将来像) carry a `mergeInto: 'AY'` instead and are folded into 備考(AY) as `【ラベル】値` at save time — the sheet is never structurally widened.
- Writes go through `apps-script/Code.gs` (Google Apps Script Web App, `doPost`): it ensures the row-25 headers, finds the next empty data row (≥26, keyed on お客様名/E), and writes each value by column letter; `保存日時`(AZ) + `閲覧URL`(BA) are auto-set. The browser POSTs as `text/plain` to avoid CORS preflight. The Web App URL is configured in the console's ⚙︎ 設定 (stored in localStorage).
- If you change `FIELDS`, also update `HEADERS` in `Code.gs` and the spreadsheet's row-25 headers. No tests/lint/build. See `echo-interview-console/README.md` (Japanese) for deploy steps.

### `construction-book/` — 施工記録ブック作成ツール (construction record book builder)
Zero-dependency single-file vanilla-JS app (no build step — like `echo-interview-console`/`claude-clone`) for 株式会社 Martial Arts (不動産・建設). The operator fills a form (表紙・物件情報 → 工事概要 → 施工工程 → 完了報告 → 会社情報) and the right pane renders a **print/PDF-ready A4 「施工記録ブック」** to hand to the customer.

- Run: `cd construction-book && python3 -m http.server 5181` → http://localhost:5181 (no install/build); opening `index.html` directly also works (fully client-side).
- **Everything lives in `construction-book/index.html`** (markup + CSS + JS in one file). Two-pane editor/live-preview; output is one A4 `.page` per section via `@media print` (A4 = 794×1123px @96dpi). Export = browser print dialog → "Save as PDF".
- Data persists to **localStorage** only (no backend): books under `martialarts_construction_books_v1`, active id under `martialarts_construction_active_v1`. Multiple books are managed via the 一覧 modal; autosave is debounced.
- 施工工程 pages are repeatable; each holds 工程名/実施日/説明 + multiple photos with a 施工前/施工中/施工後 label (`TAGS`) and caption. **Photos are downscaled to max 1280px JPEG (q0.78) via canvas in `compressImage()` before storage** to avoid blowing the ~5MB localStorage quota.
- No tests/lint/build. See `construction-book/README.md` (Japanese) for usage and customization (TAGS, default company info, image-compression knobs).

### `construction-portfolio/` — 施工事例パンフレット「WORKS」 (premium construction portfolio brochure)
Zero-dependency single-file vanilla-JS app (no build step) for 株式会社 Martial Arts. Where `construction-book` is a customer-facing *record* tool, this is a **sales/branding brochure** — a high-end A4 8-page portfolio (dark + gold) built from real site photos. Photos live in `construction-portfolio/img/` and are referenced relatively (like `arr-gallery-pamphlet`).

- Run: `cd construction-portfolio && python3 -m http.server 5182` → http://localhost:5182 (no install/build); opening `index.html` directly also works (keep `img/` alongside).
- **8 A4 pages**: 表紙(WORKS) → 理念 → 外観 → 住まい(LDK) → キッチン → 外構・設備 → 施工品質(基礎/上棟/断熱) → 会社情報. Output is one A4 `.page` per section via `@media print`; export = browser print dialog → "Save as PDF" (A4 = 794×1123px @96dpi).
- **In-browser editing**: text elements are `contenteditable` (click to rewrite company name/TEL/URL/copy/captions); images have `class="ph"` and are **click-to-replace** (canvas-compressed to max 1600px JPEG). Edits autosave to localStorage (`martialarts_portfolio_v1`); a 初期化 button restores the original. Toolbar (`#bar`) and edit outlines are hidden in print.
- Typography uses a Latin serif stack for display headings + JP gothic (`IPAGothic` fallback in this repo's render env — no mincho installed). No tests/lint/build. See `construction-portfolio/README.md` (Japanese).

### `japan-mgmt-line-bot/` — ジャパンマネジメント FAQ LINE ボット
Node + Express ES Modules app (dependency: `express` only; Node 18+ global `fetch`) implementing a **rule-based FAQ LINE bot** for 株式会社ジャパンマネジメント (http://japan-mgmt.co.jp/, factoring / 資金調達 / コンサル). No AI/LLM — fixed keyword→answer rules only. Same build as `Chat-Bridge`'s LINE webhook: Express + `/webhook` route + `X-Line-Signature` (HMAC-SHA256) verification + LINE reply API.

- `cd japan-mgmt-line-bot && cp .env.example .env` (set `LINE_CHANNEL_SECRET` + `LINE_CHANNEL_ACCESS_TOKEN`), then `npm install && npm start` → http://localhost:3000. Dev: `npm run dev` (`node --watch`).
- **`faq.js` is the single source of truth**: edit the `FAQ` array (`{ id, label, keywords, answer }`, evaluated top-down, first keyword hit wins), `MENU_LABELS` (quick-reply menu), and `COMPANY` (tel/hours/site). Placeholders are marked `〔要確認〕` — replace with real values (手数料率/対応エリア/連絡先).
- `server.js` verifies the signature against the **raw** body (`express.raw`) then parses JSON; always returns 200 to LINE; replies via `https://api.line.me/v2/bot/message/reply`. Graceful degradation: no `LINE_CHANNEL_SECRET` → signature check skipped (dev), no `LINE_CHANNEL_ACCESS_TOKEN` → reply is logged as dry-run.
- Offline check without LINE: `GET /dev/simulate?text=手数料` (disabled when `NODE_ENV=production`); `GET /health`. No build/test/lint. `.env` is gitignored. See `japan-mgmt-line-bot/README.md` (Japanese) for LINE Developers setup.

### `financial-literacy-line-bot/` — 金融リテラシーボット (株式会社ジャパンマネジメント)
Node + Express ES Modules app (dependency: `express` only) — a **rule-based FAQ LINE bot** that teaches money basics (家計/保険/投資/NISA・iDeCo/税金/年金/住宅ローン/相続/詐欺対策) as customer-facing financial education for 株式会社ジャパンマネジメント (http://japan-mgmt.co.jp/). Topic structure **follows the `fp` repo's knowledge areas**, rebranded to japan-mgmt (contact/site/consult CTA). Same build as `japan-mgmt-line-bot` (Express + `/webhook` + `X-Line-Signature` HMAC-SHA256 verification + reply API), no AI.

- `cd financial-literacy-line-bot && cp .env.example .env` (set `LINE_CHANNEL_SECRET` + `LINE_CHANNEL_ACCESS_TOKEN`), then `npm install && npm start` → http://localhost:3000. Dev: `npm run dev`.
- **`faq.js` is the single source of truth**: FAQ rules (`{ id, label, keywords, answer }`, top-down first-hit), `MENU_LABELS`, and `PROGRAM` (name/tel/hours/site/**disclaimer**). Every greeting includes the disclaimer — this is financial *education*, not investment advice; NISA/iDeCo/tax figures change, so verify against 金融庁/国税庁/日本年金機構 and keep `〔要確認〕` values current.
- `server.js` is structurally identical to `japan-mgmt-line-bot/server.js`. Offline check: `GET /dev/simulate?text=NISA` (disabled when `NODE_ENV=production`); `GET /health`. No build/test/lint. `.env` is gitignored. See `financial-literacy-line-bot/README.md` (Japanese).
- Deploy: root `render.yaml` is the Render Blueprint for this bot (`rootDir: financial-literacy-line-bot`, health check `/health`); the README has a one-click "Deploy to Render" button. `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` are `sync: false` — set them in the Render dashboard, never in Git. Free tier sleeps → cold start can drop the first LINE message.

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
