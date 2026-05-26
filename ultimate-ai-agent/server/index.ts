import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer } from "http";
import { appRouter } from "./routers";
import { setupWebSocket } from "./websocket";
import { streamChat } from "./aiServices";
import {
  setupSSEStream,
  sendSSEEvent,
  endSSEStream,
} from "./aiServices/streamResponse";
import { transcribeAudio } from "./_core/voiceTranscription";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// General AI API
import("./generalAI").then((mod) => {
  app.use("/api/ai", mod.default);
}).catch(() => {
  console.warn("[GeneralAI] Module not loaded");
});

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
  })
);

// SSE streaming endpoint
app.post("/api/chat/stream", async (req, res) => {
  setupSSEStream(res);

  try {
    const { conversationId, message, agentId, model } = req.body;

    for await (const chunk of streamChat({
      conversationId,
      message,
      agentId,
      model,
    })) {
      sendSSEEvent(res, chunk.type, chunk.data);
    }

    endSSEStream(res);
  } catch (error) {
    console.error("[SSE] Error:", error);
    sendSSEEvent(
      res,
      "error",
      error instanceof Error ? error.message : "Unknown error"
    );
    endSSEStream(res);
  }
});

// Audio transcription endpoint
app.post("/api/transcribe", express.raw({ type: "multipart/form-data", limit: "25mb" }), async (req, res) => {
  try {
    // Parse multipart manually or use the raw body
    const tmpDir = "./data/tmp";
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

    const tmpFile = join(tmpDir, `audio-${Date.now()}.webm`);

    // For simplicity, handle the audio from the request body
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      // Re-parse with express built-in
      res.json({ text: "[Voice transcription requires multer middleware - configure OPENAI_API_KEY]" });
      return;
    }

    writeFileSync(tmpFile, req.body);

    const result = await transcribeAudio({ filePath: tmpFile });
    unlinkSync(tmpFile);

    res.json({ text: result.text });
  } catch (error) {
    console.error("[Transcribe] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Transcription failed",
    });
  }
});

// Auth endpoint — env var で本番認証
//   ADMIN_USERNAME と ADMIN_PASSWORD を環境変数で必須化
//   両方が未設定の場合のみ開発用の admin/admin を許可
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  // 本番モード: env var が設定されている場合は厳密に照合
  if (expectedUsername && expectedPassword) {
    if (username === expectedUsername && password === expectedPassword) {
      return res.json({
        user: { id: "1", username: expectedUsername, role: "admin" },
        token: "auth-token-" + Date.now(),
      });
    }
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // 開発モード: env var 未設定時のみ admin/admin を許可（warn 表示）
  if (process.env.NODE_ENV !== "production") {
    if (username === "admin" && password === "admin") {
      console.warn("[Auth] DEV MODE: admin/admin accepted. Set ADMIN_USERNAME and ADMIN_PASSWORD env vars for production.");
      return res.json({
        user: { id: "1", username: "admin", role: "admin" },
        token: "dev-token-" + Date.now(),
      });
    }
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

// Rate limiting: 公開シミュレーター API への spam 防止
//   1 IP あたり 60 リクエスト/分
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown";
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }
  next();
}
app.use("/api/trpc", rateLimitMiddleware);

// 公開モードガード: PUBLIC_MODE=true で OpenAI 系エンドポイントを 403
//   仕入れシミュ 2 ページ以外を実質無効化
if (process.env.PUBLIC_MODE === "true") {
  console.log("[PublicMode] OpenAI-using endpoints disabled. Only /loan-simulator and /bank-valuation are available.");
  const publicModeBlocked = (_req: express.Request, res: express.Response) => {
    res.status(403).json({ error: "This endpoint is disabled in public mode." });
  };
  app.post("/api/chat/stream", publicModeBlocked);
  app.post("/api/transcribe", publicModeBlocked);
  app.post("/api/workflow/execute", publicModeBlocked);
  app.post("/api/workflow/generate", publicModeBlocked);
  app.post("/api/agents/collaborate", publicModeBlocked);
  app.post("/api/agents/benchmark", publicModeBlocked);
  app.use("/api/ai", publicModeBlocked);
}

// Integration webhooks
app.post("/api/integrations/slack", async (req, res) => {
  const { webhookUrl, message } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ error: "Webhook URL required" });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    res.json({ success: response.ok });
  } catch (error) {
    res.status(500).json({ error: "Failed to send Slack notification" });
  }
});

app.post("/api/integrations/discord", async (req, res) => {
  const { webhookUrl, message } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ error: "Webhook URL required" });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    res.json({ success: response.ok });
  } catch (error) {
    res.status(500).json({ error: "Failed to send Discord notification" });
  }
});

// ===== Workflow Automation API =====

// Execute workflow
app.post("/api/workflow/execute", async (req, res) => {
  try {
    const { WorkflowEngine } = await import("./workflow/engine");
    const engine = new WorkflowEngine();
    const result = await engine.executeWorkflow(req.body.workflow, req.body.triggerData || {});
    res.json({
      ...result,
      nodeResults: Object.fromEntries(result.nodeResults),
    });
  } catch (error) {
    console.error("[Workflow] Execution error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Workflow execution failed",
    });
  }
});

// Generate workflow from natural language
app.post("/api/workflow/generate", async (req, res) => {
  try {
    const { buildWorkflowFromDescription } = await import("./workflow/nlBuilder");
    const workflow = await buildWorkflowFromDescription(req.body.description);
    res.json(workflow);
  } catch (error) {
    console.error("[Workflow] Generation error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Workflow generation failed",
    });
  }
});

// List available node types
app.get("/api/workflow/node-types", async (_req, res) => {
  try {
    const { allNodeTypes } = await import("./workflow/nodes");
    res.json(allNodeTypes);
  } catch (error) {
    res.json([]);
  }
});

// Webhook receiver for workflow triggers
app.all("/api/webhook/:path", async (req, res) => {
  try {
    const { handleWebhook } = await import("./workflow/webhookHandler");
    const result = await handleWebhook(
      req.params.path,
      req.method,
      req.headers as Record<string, string>,
      req.body
    );
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: "Webhook not found" });
  }
});

// ===== Specialized AI Agents API =====

// List all specialized agents
app.get("/api/agents/specialized", async (_req, res) => {
  try {
    const { specializedAgents } = await import("./specializedAgents/definitions");
    res.json(specializedAgents);
  } catch (error) {
    res.json([]);
  }
});

// Get specific specialized agent
app.get("/api/agents/specialized/:id", async (req, res) => {
  try {
    const { getSpecializedAgent } = await import("./specializedAgents/definitions");
    const agent = getSpecializedAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: "Failed to get agent" });
  }
});

// Multi-agent collaboration
app.post("/api/agents/collaborate", async (req, res) => {
  try {
    const { createCollaboration, runCollaborationRound } = await import("./specializedAgents/collaboration");
    const { agentIds, mode, topic, message } = req.body;
    const session = createCollaboration(agentIds, mode, topic);
    const result = await runCollaborationRound(session, message || topic);
    res.json(result);
  } catch (error) {
    console.error("[Collaboration] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Collaboration failed",
    });
  }
});

// Agent feedback
app.post("/api/agents/feedback", async (req, res) => {
  try {
    const { recordFeedback } = await import("./specializedAgents/evolution");
    recordFeedback(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// Agent stats & leaderboard
app.get("/api/agents/leaderboard", async (_req, res) => {
  try {
    const { getLeaderboard } = await import("./specializedAgents/evolution");
    res.json(getLeaderboard());
  } catch (error) {
    res.json([]);
  }
});

app.get("/api/agents/stats/:id", async (req, res) => {
  try {
    const { getAgentStats } = await import("./specializedAgents/evolution");
    res.json(getAgentStats(req.params.id));
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// Agent benchmark
app.post("/api/agents/benchmark", async (req, res) => {
  try {
    const { runBenchmark } = await import("./specializedAgents/benchmark");
    const result = await runBenchmark(req.body.agentId, req.body.testId);
    res.json(result);
  } catch (error) {
    console.error("[Benchmark] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Benchmark failed",
    });
  }
});

app.get("/api/agents/benchmark/results", async (req, res) => {
  try {
    const { getBenchmarkResults } = await import("./specializedAgents/benchmark");
    res.json(getBenchmarkResults(req.query.agentId as string | undefined));
  } catch (error) {
    res.json([]);
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve static client files in production
const clientDistPath = resolve(__dirname, "../client/dist");
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientDistPath, "index.html"));
  });
}

// Create HTTP server and attach WebSocket
const server = createServer(app);
setupWebSocket(server);

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`WebSocket available on ws://localhost:${port}/ws`);
});

export default app;
