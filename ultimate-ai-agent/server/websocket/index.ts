import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { streamChat } from "../aiServices";

interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] Client connected");

    ws.on("message", async (data: Buffer) => {
      try {
        const msg: WSMessage = JSON.parse(data.toString());

        if (msg.type === "chat") {
          const { conversationId, message, agentId, model } = msg.payload as {
            conversationId?: number;
            message: string;
            agentId?: string;
            model?: string;
          };

          for await (const chunk of streamChat({
            conversationId,
            message,
            agentId,
            model,
          })) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(chunk));
            }
          }
        }
      } catch (error) {
        console.error("[WS] Error:", error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "error",
              data: error instanceof Error ? error.message : "Unknown error",
            })
          );
        }
      }
    });

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
    });
  });

  return wss;
}
