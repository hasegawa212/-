import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

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

  try {
    const client = new Anthropic({ apiKey: API_KEY });
    const response = await client.messages.create({
      model: MODEL_MAP[model] || MODEL_MAP["clone-sonnet"],
      max_tokens: 1024,
      system:
        "You are Open Clone, a helpful, concise assistant inspired by Claude. " +
        "Reply in the same language the user wrote in.",
      messages: apiMessages,
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    res.json({ content: text, model: response.model });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    res.status(500).json({ error: err?.message || "Upstream error." });
  }
});

app.listen(PORT, () => {
  console.log(`Open Clone server listening on http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn("[warn] ANTHROPIC_API_KEY is not set — /api/chat will return 503.");
  }
});
