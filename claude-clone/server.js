import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const MODEL_MAP = {
  "clone-opus": "claude-opus-4-7",
  "clone-sonnet": "claude-sonnet-4-6",
  "clone-haiku": "claude-haiku-4-5-20251001",
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({
      error: "ANTHROPIC_API_KEY is not set on the server.",
    });
  }

  const { messages = [], model = "clone-sonnet" } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages[] is required." });
  }

  const apiMessages = messages
    .filter((m) => m && typeof m.content === "string" && !m.typing)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  // Server-Sent Events: stream text deltas to the client as they arrive.
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const client = new Anthropic({ apiKey: API_KEY });
    const stream = client.messages.stream({
      model: MODEL_MAP[model] || MODEL_MAP["clone-sonnet"],
      max_tokens: 1024,
      system: buildSystemPrompt({ model }),
      messages: apiMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta"
      ) {
        send("delta", { text: event.delta.text });
      }
    }

    const final = await stream.finalMessage();
    send("done", { model: final.model });
    res.end();
  } catch (err) {
    console.error("[/api/chat] error:", err);
    // Headers are already sent, so report the error inside the SSE stream.
    send("error", { error: err?.message || "Upstream error." });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Open Clone server listening on http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn("[warn] ANTHROPIC_API_KEY is not set — /api/chat will return 503.");
  }
});
