// ── Shared Types ────────────────────────────────────────────────────

export interface ConfigField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "code" | "json";
  default?: unknown;
  options?: string[];
}

export interface NodeTypeDefinition {
  type: string;
  label: string;
  category: string;
  description: string;
  icon: string;
  inputs: ConfigField[];
  outputs: string[];
  color: string;
}

export type NodeTypeHandler = (
  config: Record<string, unknown>,
  inputs: Record<string, unknown>,
  context: any,
) => Promise<unknown>;

// ── Imports ─────────────────────────────────────────────────────────

import {
  handle_trigger_manual,
  handle_trigger_webhook,
  handle_trigger_cron,
  handle_trigger_event,
  handle_trigger_ai_chat,
  triggerNodeTypes,
} from "./triggers.js";

import {
  handle_ai_llm,
  handle_ai_chat,
  handle_ai_summarize,
  handle_ai_classify,
  handle_ai_extract,
  handle_ai_translate,
  handle_ai_sentiment,
  handle_ai_embedding,
  aiNodeTypes,
} from "./ai.js";

import {
  handle_logic_if,
  handle_logic_switch,
  handle_logic_loop,
  handle_logic_delay,
  handle_logic_merge,
  handle_logic_filter,
  handle_logic_error_handler,
  logicNodeTypes,
} from "./logic.js";

import {
  handle_data_transform,
  handle_data_template,
  handle_data_json_parse,
  handle_data_json_stringify,
  handle_data_split,
  handle_data_aggregate,
  dataNodeTypes,
} from "./data.js";

import {
  handle_http_request,
  handle_slack_send,
  handle_discord_send,
  handle_email_send,
  handle_db_query,
  handle_file_read,
  handle_file_write,
  handle_rss_fetch,
  integrationNodeTypes,
} from "./integrations.js";

// ── Re-export all handlers and definition arrays ────────────────────

export {
  // Triggers
  handle_trigger_manual,
  handle_trigger_webhook,
  handle_trigger_cron,
  handle_trigger_event,
  handle_trigger_ai_chat,
  triggerNodeTypes,
  // AI
  handle_ai_llm,
  handle_ai_chat,
  handle_ai_summarize,
  handle_ai_classify,
  handle_ai_extract,
  handle_ai_translate,
  handle_ai_sentiment,
  handle_ai_embedding,
  aiNodeTypes,
  // Logic
  handle_logic_if,
  handle_logic_switch,
  handle_logic_loop,
  handle_logic_delay,
  handle_logic_merge,
  handle_logic_filter,
  handle_logic_error_handler,
  logicNodeTypes,
  // Data
  handle_data_transform,
  handle_data_template,
  handle_data_json_parse,
  handle_data_json_stringify,
  handle_data_split,
  handle_data_aggregate,
  dataNodeTypes,
  // Integrations
  handle_http_request,
  handle_slack_send,
  handle_discord_send,
  handle_email_send,
  handle_db_query,
  handle_file_read,
  handle_file_write,
  handle_rss_fetch,
  integrationNodeTypes,
};

// ── Node-type handler registry ──────────────────────────────────────

export const nodeTypeRegistry = new Map<string, NodeTypeHandler>([
  // Triggers
  ["trigger_manual", handle_trigger_manual],
  ["trigger_webhook", handle_trigger_webhook],
  ["trigger_cron", handle_trigger_cron],
  ["trigger_event", handle_trigger_event],
  ["trigger_ai_chat", handle_trigger_ai_chat],

  // AI
  ["ai_llm", handle_ai_llm],
  ["ai_chat", handle_ai_chat],
  ["ai_summarize", handle_ai_summarize],
  ["ai_classify", handle_ai_classify],
  ["ai_extract", handle_ai_extract],
  ["ai_translate", handle_ai_translate],
  ["ai_sentiment", handle_ai_sentiment],
  ["ai_embedding", handle_ai_embedding],

  // Logic
  ["logic_if", handle_logic_if],
  ["logic_switch", handle_logic_switch],
  ["logic_loop", handle_logic_loop],
  ["logic_delay", handle_logic_delay],
  ["logic_merge", handle_logic_merge],
  ["logic_filter", handle_logic_filter],
  ["logic_error_handler", handle_logic_error_handler],

  // Data
  ["data_transform", handle_data_transform],
  ["data_template", handle_data_template],
  ["data_json_parse", handle_data_json_parse],
  ["data_json_stringify", handle_data_json_stringify],
  ["data_split", handle_data_split],
  ["data_aggregate", handle_data_aggregate],

  // Integrations
  ["http_request", handle_http_request],
  ["slack_send", handle_slack_send],
  ["discord_send", handle_discord_send],
  ["email_send", handle_email_send],
  ["db_query", handle_db_query],
  ["file_read", handle_file_read],
  ["file_write", handle_file_write],
  ["rss_fetch", handle_rss_fetch],
]);

// ── All node-type definitions (flat array for the UI) ───────────────

export const allNodeTypes: NodeTypeDefinition[] = [
  ...triggerNodeTypes,
  ...aiNodeTypes,
  ...logicNodeTypes,
  ...dataNodeTypes,
  ...integrationNodeTypes,
];
