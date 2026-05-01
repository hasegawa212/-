# CLAUDE.md

## Project Overview

**Ultimate AI Agent** is a full-stack AI chatbot and workflow automation platform built as a TypeScript monorepo. It provides multi-agent orchestration, RAG (Retrieval-Augmented Generation), workflow automation, and specialized domain agents — all powered by OpenAI's API.

## Tech Stack

| Layer      | Technology                                      |
|------------|------------------------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS, Radix UI          |
| Backend    | Express.js, tRPC, WebSocket (ws)                |
| Database   | SQLite (better-sqlite3) via Drizzle ORM         |
| AI         | OpenAI SDK (gpt-4o-mini default)                |
| Language   | TypeScript 5.5 (strict mode) throughout         |
| Validation | Zod schemas for all data boundaries             |

## Repository Structure

```
ultimate-ai-agent/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── pages/           # Page components (Chat, Workflows, Analytics, etc.)
│   │   ├── components/      # Reusable UI components, workflow nodes
│   │   ├── contexts/        # React contexts (Auth, Theme, I18n, Notifications)
│   │   ├── hooks/           # Custom hooks (WebSocket, utilities)
│   │   └── lib/             # tRPC client, utils, i18n config
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── server/                  # Express.js backend
│   ├── _core/               # LLM integration, voice, image gen, notifications
│   ├── aiServices/          # Chat streaming, tool execution, memory management
│   ├── autonomousAgent/     # Autonomous agent implementation
│   ├── learning/            # Agent learning modules
│   ├── orchestrator/        # Multi-agent orchestration
│   ├── rag/                 # RAG system (document indexing & retrieval)
│   ├── runtime/             # Tool registry, pipelines, conversation runner
│   ├── specializedAgents/   # Domain-specific agents
│   ├── tools/               # Web search, code execution tools
│   ├── websocket/           # WebSocket server
│   ├── workflow/            # Workflow engine, nodes, scheduler, NL builder
│   ├── index.ts             # Server entry point
│   ├── routers.ts           # tRPC router definitions (all API routes)
│   ├── db.ts                # Database initialization
│   ├── agents.ts            # Default agents and prompt templates
│   └── generalAI.ts         # General AI REST endpoints
├── shared/                  # Shared TypeScript types & Zod schemas
│   ├── types.ts             # Core types: Message, Conversation, Agent, Workflow, etc.
│   └── agentResponse.ts     # Structured response schemas
├── drizzle/                 # Database layer
│   ├── schema.ts            # Drizzle table definitions (6 tables)
│   └── migrations/          # Generated migration files
├── package.json             # Root workspace scripts
├── tsconfig.json            # Root TS config (server + shared)
├── drizzle.config.ts        # Drizzle Kit configuration
├── Dockerfile               # Multi-stage Docker build
└── docker-compose.yml       # Docker Compose with health checks
```

## Development Commands

```bash
# Install dependencies (run from root AND from client/ and server/ directories)
npm install

# Start both client and server in development mode
npm run dev

# Start only the client (Vite dev server on port 5173)
npm run dev:client

# Start only the server (tsx watch on port 3000)
npm run dev:server

# Build the client for production
npm run build

# Database migrations
npm run db:generate    # Generate Drizzle migration files
npm run db:push        # Push schema directly to database
npm run db:migrate     # Run pending migrations
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable       | Required | Default        | Description                        |
|---------------|----------|----------------|------------------------------------|
| OPENAI_API_KEY | Yes      | —              | OpenAI API key for AI features     |
| PORT           | No       | 3000           | Server port                        |
| DATABASE_URL   | No       | ./data/app.db  | SQLite database file path          |

## Architecture & Key Patterns

### API Layer (tRPC)
- All client-server communication uses **tRPC** for end-to-end type safety
- Router defined in `server/routers.ts` with namespaced sub-routers: `conversations`, `messages`, `chat`, `agents`, `rag`, `memory`, `workflows`, `analytics`, `search`, `promptTemplates`, `health`
- Additional REST endpoints in `server/generalAI.ts` for streaming and specialized features
- Client tRPC setup in `client/src/lib/trpc.ts`

### Database (Drizzle ORM + SQLite)
- Schema defined in `drizzle/schema.ts` with 6 tables: `conversations`, `messages`, `agents`, `ragDocuments`, `memoryEntries`, `workflows`, `analyticsEvents`
- Database initialized in `server/db.ts` (includes inline table creation as fallback)
- Temperature stored as integer (x10) in DB, converted to float in API layer
- JSON fields (metadata, tools, steps, embedding) stored as serialized text
- Cascade delete on messages when conversation is deleted

### Shared Types
- All Zod schemas and TypeScript types live in `shared/types.ts`
- Both client and server import from `@shared/*` via path aliases
- Path alias config: root `tsconfig.json` maps `@shared/*` → `./shared/*`; client `tsconfig.json` maps `@shared/*` → `../shared/*`

### Frontend Patterns
- **Routing:** React Router v6
- **State:** React Context (Auth, Theme, I18n, Notifications) + TanStack React Query
- **Styling:** Tailwind CSS with Radix UI component primitives
- **Path alias:** `@/*` → `./src/*` in client

### Real-time Communication
- WebSocket server (`server/websocket/`) for push notifications
- Server-Sent Events (SSE) for streaming chat responses

## Database Schema (6 tables)

| Table             | Key Columns                                           |
|-------------------|------------------------------------------------------|
| conversations     | id, title, agentId, model, systemPrompt              |
| messages          | id, conversationId (FK), role, content, metadata     |
| agents            | id (text PK), name, systemPrompt, model, tools, temperature |
| rag_documents     | id, title, content, source, embedding                |
| memory_entries    | id, conversationId (FK), key, value, type            |
| workflows         | id, name, description, steps (JSON), isActive        |
| analytics_events  | id, eventType, conversationId, agentId, tokensUsed   |

## Code Conventions

- **TypeScript strict mode** is enabled — all code must pass strict type checks
- **Zod** is used for runtime validation at API boundaries
- **ES Modules** throughout (`"type": "module"` in server package.json)
- **No linter/formatter configured** — maintain consistency with existing code style
- **No test framework configured** — no existing tests
- **Default AI model:** `gpt-4o-mini` (hardcoded in schema defaults and agent configs)
- **camelCase** for TypeScript identifiers; **snake_case** for database column names
- Drizzle schema maps between the two naming conventions automatically

## Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up --build

# Production container exposes port 3000
# SQLite database persisted via volume mount at /app/data/
```

The Dockerfile uses a multi-stage build (install deps → build client → run server).

## Key Files for Common Tasks

| Task                        | Files to modify                              |
|-----------------------------|----------------------------------------------|
| Add a new API route         | `server/routers.ts`, `shared/types.ts`       |
| Add a new database table    | `drizzle/schema.ts`, then `npm run db:push`  |
| Add a new page/feature      | `client/src/pages/`, update router config    |
| Modify agent behavior       | `server/agents.ts`, `server/aiServices/`     |
| Add a new tool for agents   | `server/tools/`, `server/runtime/`           |
| Change workflow nodes        | `server/workflow/`, `client/src/components/` |
| Update shared types         | `shared/types.ts`                            |
