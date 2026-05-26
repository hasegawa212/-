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

// 銀行評価額シミュレーター: 案件保存・実績記録
export const bankValuationDeals = sqliteTable("bank_valuation_deals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealCode: text("deal_code").notNull().unique(), // 案件 ID（業務マニュアルの採番ルールと連携。例: DEAL-2026-00001）
  title: text("title").notNull(), // 物件メモ（PII を含まない簡易ラベル）
  inputJson: text("input_json", { mode: "json" }).notNull(), // ValuationInput スナップショット
  resultJson: text("result_json", { mode: "json" }).notNull(), // ValuationResult スナップショット（予測）
  // 実績フィールド（融資審査後に後追い記録）
  actualBankId: text("actual_bank_id"), // 実取引銀行ID（megabank / regional / shinkin / nonbank ほか自由文字列）
  actualBankName: text("actual_bank_name"), // 銀行名（自由テキスト）
  actualValuationYen: integer("actual_valuation_yen"), // 実際の銀行評価額
  actualLoanYen: integer("actual_loan_yen"), // 実際の融資承認額
  actualInterestRateX100: integer("actual_interest_rate_x100"), // 金利（×100、例: 2.75% → 275）
  dealStatus: text("deal_status", {
    enum: ["pending", "approved", "rejected", "closed"],
  })
    .notNull()
    .default("pending"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// 銀行プロファイル校正（実績ベース学習結果）
export const bankProfileCalibrations = sqliteTable("bank_profile_calibrations", {
  bankId: text("bank_id").primaryKey(), // megabank / regional / shinkin / nonbank
  sampleCount: integer("sample_count").notNull().default(0),
  // 各倍率 ×1000 で整数保管（例: 0.923 → 923）
  loanMultiplierX1000: integer("loan_multiplier_x1000").notNull().default(1000),
  valuationMultiplierX1000: integer("valuation_multiplier_x1000").notNull().default(1000),
  effectiveLtvX1000: integer("effective_ltv_x1000").notNull().default(0),
  meanActualValuationYen: integer("mean_actual_valuation_yen").notNull().default(0),
  meanActualLoanYen: integer("mean_actual_loan_yen").notNull().default(0),
  meanPredictedValuationYen: integer("mean_predicted_valuation_yen").notNull().default(0),
  meanPredictedLoanYen: integer("mean_predicted_loan_yen").notNull().default(0),
  computedAt: text("computed_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
