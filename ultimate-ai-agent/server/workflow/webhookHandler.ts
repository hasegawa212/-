import { Router } from "express";
import type { Request, Response } from "express";

interface WebhookRegistration {
  workflowId: string;
  path: string;
  method: string;
  createdAt: string;
}

type WebhookCallback = (data: {
  workflowId: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  method: string;
  path: string;
}) => Promise<unknown>;

export class WebhookHandler {
  private webhooks = new Map<string, WebhookRegistration>();
  private pathIndex = new Map<string, string>();
  private callback: WebhookCallback | null = null;

  onWebhook(callback: WebhookCallback) {
    this.callback = callback;
  }

  registerWebhook(
    workflowId: string,
    path: string,
    method: string = "POST"
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const normalizedMethod = method.toUpperCase();
    const key = `${normalizedMethod}:${normalizedPath}`;

    this.unregisterWebhook(workflowId);

    const registration: WebhookRegistration = {
      workflowId,
      path: normalizedPath,
      method: normalizedMethod,
      createdAt: new Date().toISOString(),
    };

    this.webhooks.set(workflowId, registration);
    this.pathIndex.set(key, workflowId);

    return `/api/webhooks${normalizedPath}`;
  }

  unregisterWebhook(workflowId: string): boolean {
    const existing = this.webhooks.get(workflowId);
    if (!existing) return false;

    const key = `${existing.method}:${existing.path}`;
    this.pathIndex.delete(key);
    this.webhooks.delete(workflowId);
    return true;
  }

  async handleWebhook(
    path: string,
    method: string,
    headers: Record<string, string>,
    body: unknown
  ): Promise<{ workflowId: string; result: unknown } | null> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const normalizedMethod = method.toUpperCase();
    const key = `${normalizedMethod}:${normalizedPath}`;

    const workflowId = this.pathIndex.get(key);
    if (!workflowId) return null;

    if (!this.callback) {
      throw new Error("No webhook callback registered");
    }

    const result = await this.callback({
      workflowId,
      headers,
      body,
      query: {},
      method: normalizedMethod,
      path: normalizedPath,
    });

    return { workflowId, result };
  }

  listWebhooks(): WebhookRegistration[] {
    return Array.from(this.webhooks.values());
  }

  getWebhookForWorkflow(workflowId: string): WebhookRegistration | undefined {
    return this.webhooks.get(workflowId);
  }
}

export function createWebhookRouter(handler: WebhookHandler): Router {
  const router = Router();

  router.all("/*", async (req: Request, res: Response) => {
    const webhookPath = req.path;
    const method = req.method;
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }

    try {
      const result = await handler.handleWebhook(
        webhookPath,
        method,
        headers,
        req.body
      );

      if (!result) {
        res.status(404).json({ error: "No webhook registered for this path" });
        return;
      }

      const output = result.result as Record<string, unknown> | undefined;
      if (output && typeof output === "object" && "statusCode" in output) {
        res
          .status(output.statusCode as number)
          .json(output.body ?? { success: true });
      } else {
        res.json({
          success: true,
          workflowId: result.workflowId,
          result: result.result,
        });
      }
    } catch (err) {
      console.error("[Webhook] Error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Webhook execution failed",
      });
    }
  });

  return router;
}
