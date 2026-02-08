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

// Auth endpoint (simple demo auth)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  // Demo authentication - in production use proper auth
  if (username === "admin" && password === "admin") {
    res.json({
      user: { id: "1", username: "admin", role: "admin" },
      token: "demo-token-" + Date.now(),
    });
  } else if (username && password === password) {
    // Accept any username/password for demo
    res.json({
      user: { id: "2", username, role: "user" },
      token: "demo-token-" + Date.now(),
    });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

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
