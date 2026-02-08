import type { NodeTypeDefinition, NodeTypeHandler } from "./index.js";

// ── Trigger: Manual ──────────────────────────────────────────────────
export const handle_trigger_manual: NodeTypeHandler = async (
  config,
  inputs,
  _context,
) => {
  return {
    triggeredAt: new Date().toISOString(),
    manual: true,
    ...(inputs.data !== undefined ? { data: inputs.data } : {}),
  };
};

// ── Trigger: Webhook ─────────────────────────────────────────────────
export const handle_trigger_webhook: NodeTypeHandler = async (
  config,
  inputs,
  _context,
) => {
  const method = (config.method as string) || "POST";
  const path = (config.path as string) || "/webhook";
  return {
    method,
    path,
    body: inputs.body ?? {},
    headers: inputs.headers ?? {},
    params: inputs.params ?? {},
    query: inputs.query ?? {},
  };
};

// ── Trigger: Cron / Scheduled ────────────────────────────────────────
export const handle_trigger_cron: NodeTypeHandler = async (
  config,
  _inputs,
  _context,
) => {
  const schedule = (config.schedule as string) || "* * * * *";
  return {
    timestamp: new Date().toISOString(),
    scheduledTime: new Date().toISOString(),
    schedule,
  };
};

// ── Trigger: Event ───────────────────────────────────────────────────
export const handle_trigger_event: NodeTypeHandler = async (
  config,
  inputs,
  _context,
) => {
  const eventName = (config.eventName as string) || "unknown";
  return {
    eventName,
    data: inputs.data ?? {},
    timestamp: new Date().toISOString(),
  };
};

// ── Trigger: AI Chat ─────────────────────────────────────────────────
export const handle_trigger_ai_chat: NodeTypeHandler = async (
  config,
  inputs,
  _context,
) => {
  const agentId = (config.agentId as string) || "";
  return {
    message: (inputs.message as string) || "",
    userId: (inputs.userId as string) || "anonymous",
    agentId,
    timestamp: new Date().toISOString(),
  };
};

// ── Node-type definitions (for the UI) ───────────────────────────────
export const triggerNodeTypes: NodeTypeDefinition[] = [
  {
    type: "trigger_manual",
    label: "Manual Trigger",
    category: "triggers",
    description: "Manually start the workflow",
    icon: "Play",
    inputs: [],
    outputs: ["trigger"],
    color: "#6366f1",
  },
  {
    type: "trigger_webhook",
    label: "Webhook Trigger",
    category: "triggers",
    description: "Trigger workflow via an incoming HTTP webhook",
    icon: "Webhook",
    inputs: [
      {
        key: "method",
        label: "HTTP Method",
        type: "select",
        default: "POST",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      },
      { key: "path", label: "Path", type: "string", default: "/webhook" },
    ],
    outputs: ["body", "headers", "params"],
    color: "#6366f1",
  },
  {
    type: "trigger_cron",
    label: "Scheduled Trigger",
    category: "triggers",
    description: "Run the workflow on a cron schedule",
    icon: "Clock",
    inputs: [
      {
        key: "schedule",
        label: "Cron Expression",
        type: "string",
        default: "0 * * * *",
      },
    ],
    outputs: ["trigger"],
    color: "#6366f1",
  },
  {
    type: "trigger_event",
    label: "Event Trigger",
    category: "triggers",
    description: "Trigger workflow when a named event fires",
    icon: "Zap",
    inputs: [
      { key: "eventName", label: "Event Name", type: "string", default: "" },
    ],
    outputs: ["event"],
    color: "#6366f1",
  },
  {
    type: "trigger_ai_chat",
    label: "Chat Message Trigger",
    category: "triggers",
    description: "Trigger workflow when a chat message is received",
    icon: "MessageSquare",
    inputs: [
      { key: "agentId", label: "Agent ID", type: "string", default: "" },
    ],
    outputs: ["message", "userId"],
    color: "#6366f1",
  },
];
