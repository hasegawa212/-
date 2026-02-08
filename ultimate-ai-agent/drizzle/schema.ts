import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default("New Conversation"),
  agentId: text("agent_id"),
  model: text("model").notNull().default("gpt-4o-mini"),
  systemPrompt: text("system_prompt"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-4o-mini"),
  tools: text("tools", { mode: "json" }).$type<string[]>().notNull().default([]),
  temperature: integer("temperature").notNull().default(7), // stored as x10
  maxTokens: integer("max_tokens").notNull().default(4096),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const ragDocuments = sqliteTable("rag_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source"),
  embedding: text("embedding"), // JSON serialized vector
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const memoryEntries = sqliteTable("memory_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").references(() => conversations.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
  type: text("type", { enum: ["fact", "preference", "context"] })
    .notNull()
    .default("fact"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const workflows = sqliteTable("workflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  steps: text("steps", { mode: "json" })
    .$type<Array<{ id: string; type: string; config: Record<string, unknown> }>>()
    .notNull()
    .default([]),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const analyticsEvents = sqliteTable("analytics_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventType: text("event_type").notNull(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  agentId: text("agent_id"),
  tokensUsed: integer("tokens_used").default(0),
  responseTimeMs: integer("response_time_ms"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
