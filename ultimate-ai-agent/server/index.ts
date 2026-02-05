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

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Create HTTP server and attach WebSocket
const server = createServer(app);
setupWebSocket(server);

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`WebSocket available on ws://localhost:${port}/ws`);
});

export default app;
