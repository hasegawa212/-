import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { db } from "../../db.js";
import { sql } from "drizzle-orm";
import type { NodeTypeDefinition, NodeTypeHandler } from "./index.js";

// ── Integration: HTTP Request ───────────────────────────────────────
export const handle_http_request: NodeTypeHandler = async (config, inputs) => {
  const url = (config.url as string) || (inputs.url as string) || "";
  const method = ((config.method as string) || "GET").toUpperCase();
  const headersRaw = (config.headers as string) || "{}";
  const bodyRaw = (config.body as string) || (inputs.body as string) || "";
  const auth = config.auth as string | undefined;

  let headers: Record<string, string> = {};
  try {
    headers =
      typeof headersRaw === "string" ? JSON.parse(headersRaw) : headersRaw;
  } catch {
    // ignore parse errors; use empty headers
  }

  if (auth) {
    headers["Authorization"] = auth;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "HEAD" && bodyRaw) {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    fetchOptions.body = typeof bodyRaw === "string" ? bodyRaw : JSON.stringify(bodyRaw);
  }

  const response = await fetch(url, fetchOptions);
  const contentType = response.headers.get("content-type") || "";
  let data: unknown;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    status: response.status,
    data,
    headers: responseHeaders,
  };
};

// ── Integration: Slack Send ─────────────────────────────────────────
export const handle_slack_send: NodeTypeHandler = async (config, inputs) => {
  const webhookUrl = (config.webhookUrl as string) || "";
  const channel = (config.channel as string) || undefined;
  const message =
    (inputs.message as string) || (inputs.data as string) || "";

  const payload: Record<string, unknown> = { text: message };
  if (channel) {
    payload.channel = channel;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return { success: response.ok };
};

// ── Integration: Discord Send ───────────────────────────────────────
export const handle_discord_send: NodeTypeHandler = async (config, inputs) => {
  const webhookUrl = (config.webhookUrl as string) || "";
  const message =
    (inputs.message as string) || (inputs.data as string) || "";

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });

  return { success: response.ok };
};

// ── Integration: Email Send (placeholder) ───────────────────────────
export const handle_email_send: NodeTypeHandler = async (config, inputs) => {
  const to = (config.to as string) || "";
  const subject = (config.subject as string) || "";
  const body =
    (inputs.body as string) || (inputs.data as string) || "";

  // Placeholder: log the email intent. Replace with a real transport
  // (e.g. nodemailer, SendGrid, SES) in production.
  console.log(`[email_send] To: ${to}, Subject: ${subject}, Body length: ${body.length}`);

  return { sent: true, to, subject };
};

// ── Integration: Database Query ─────────────────────────────────────
export const handle_db_query: NodeTypeHandler = async (config, inputs) => {
  const query = (config.query as string) || (inputs.query as string) || "";

  if (!query.trim()) {
    throw new Error("db_query: No query provided");
  }

  // Only allow SELECT queries for safety
  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT")) {
    throw new Error("db_query: Only SELECT queries are allowed for safety");
  }

  const result = db.run(sql.raw(query));
  return result;
};

// ── Integration: File Read ──────────────────────────────────────────
export const handle_file_read: NodeTypeHandler = async (config) => {
  const filePath = (config.path as string) || "";

  if (!filePath) {
    throw new Error("file_read: No path provided");
  }

  const content = await readFile(filePath, "utf-8");
  return content;
};

// ── Integration: File Write ─────────────────────────────────────────
export const handle_file_write: NodeTypeHandler = async (config, inputs) => {
  const filePath = (config.path as string) || "";
  const content =
    (inputs.content as string) || (inputs.data as string) || "";

  if (!filePath) {
    throw new Error("file_write: No path provided");
  }

  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return { success: true, path: filePath };
};

// ── Integration: RSS Fetch ──────────────────────────────────────────
export const handle_rss_fetch: NodeTypeHandler = async (config) => {
  const url = (config.url as string) || "";
  const limit = (config.limit as number) ?? 20;

  if (!url) {
    throw new Error("rss_fetch: No URL provided");
  }

  const response = await fetch(url);
  const xml = await response.text();

  // Simple XML parsing for RSS items
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link");
    const description = extractTag(itemXml, "description");
    const pubDate = extractTag(itemXml, "pubDate");
    items.push({ title, link, description, pubDate });
  }

  return items;
};

/** Extract the text content of an XML tag */
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const m = regex.exec(xml);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

// ── Node-type definitions ───────────────────────────────────────────
export const integrationNodeTypes: NodeTypeDefinition[] = [
  {
    type: "http_request",
    label: "HTTP Request",
    category: "integrations",
    description: "Make an HTTP request to any URL",
    icon: "Globe",
    inputs: [
      { key: "url", label: "URL", type: "string", default: "" },
      {
        key: "method",
        label: "Method",
        type: "select",
        default: "GET",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      },
      { key: "headers", label: "Headers (JSON)", type: "json", default: "{}" },
      { key: "body", label: "Body (JSON)", type: "json", default: "" },
      { key: "auth", label: "Authorization Header", type: "string", default: "" },
    ],
    outputs: ["status", "data", "headers"],
    color: "#3b82f6",
  },
  {
    type: "slack_send",
    label: "Send Slack Message",
    category: "integrations",
    description: "Send a message to Slack via webhook",
    icon: "Slack",
    inputs: [
      { key: "webhookUrl", label: "Webhook URL", type: "string", default: "" },
      { key: "channel", label: "Channel (optional)", type: "string", default: "" },
    ],
    outputs: ["success"],
    color: "#3b82f6",
  },
  {
    type: "discord_send",
    label: "Send Discord Message",
    category: "integrations",
    description: "Send a message to Discord via webhook",
    icon: "MessageCircle",
    inputs: [
      { key: "webhookUrl", label: "Webhook URL", type: "string", default: "" },
    ],
    outputs: ["success"],
    color: "#3b82f6",
  },
  {
    type: "email_send",
    label: "Send Email",
    category: "integrations",
    description: "Send an email (placeholder transport)",
    icon: "Mail",
    inputs: [
      { key: "to", label: "To Address", type: "string", default: "" },
      { key: "subject", label: "Subject", type: "string", default: "" },
    ],
    outputs: ["sent"],
    color: "#3b82f6",
  },
  {
    type: "db_query",
    label: "Database Query",
    category: "integrations",
    description: "Run a SELECT query against the database",
    icon: "Database",
    inputs: [
      { key: "query", label: "SQL Query", type: "code", default: "SELECT 1" },
    ],
    outputs: ["rows"],
    color: "#3b82f6",
  },
  {
    type: "file_read",
    label: "Read File",
    category: "integrations",
    description: "Read the contents of a file",
    icon: "FileInput",
    inputs: [
      { key: "path", label: "File Path", type: "string", default: "" },
    ],
    outputs: ["content"],
    color: "#3b82f6",
  },
  {
    type: "file_write",
    label: "Write File",
    category: "integrations",
    description: "Write content to a file",
    icon: "FileOutput",
    inputs: [
      { key: "path", label: "File Path", type: "string", default: "" },
    ],
    outputs: ["success"],
    color: "#3b82f6",
  },
  {
    type: "rss_fetch",
    label: "Fetch RSS Feed",
    category: "integrations",
    description: "Fetch and parse an RSS feed",
    icon: "Rss",
    inputs: [
      { key: "url", label: "Feed URL", type: "string", default: "" },
      { key: "limit", label: "Max Items", type: "number", default: 20 },
    ],
    outputs: ["items"],
    color: "#3b82f6",
  },
];
