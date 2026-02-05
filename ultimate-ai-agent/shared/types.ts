import { z } from "zod";

// Message roles
export const MessageRole = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRole>;

// Message schema
export const MessageSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  role: MessageRole,
  content: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

// Conversation schema
export const ConversationSchema = z.object({
  id: z.number(),
  title: z.string(),
  agentId: z.string().nullable(),
  model: z.string(),
  systemPrompt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// Agent definition
export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  model: z.string().default("gpt-4o-mini"),
  tools: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(4096),
  isActive: z.boolean().default(true),
});
export type Agent = z.infer<typeof AgentSchema>;

// Chat request
export const ChatRequestSchema = z.object({
  conversationId: z.number().optional(),
  message: z.string().min(1),
  agentId: z.string().optional(),
  model: z.string().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Chat response
export const ChatResponseSchema = z.object({
  conversationId: z.number(),
  message: MessageSchema,
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// RAG Document
export const RAGDocumentSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  source: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});
export type RAGDocument = z.infer<typeof RAGDocumentSchema>;

// Workflow
export const WorkflowSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      config: z.record(z.unknown()),
    })
  ),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// Analytics
export const AnalyticsSchema = z.object({
  totalConversations: z.number(),
  totalMessages: z.number(),
  totalTokensUsed: z.number(),
  averageResponseTime: z.number(),
  topAgents: z.array(
    z.object({
      agentId: z.string(),
      name: z.string(),
      messageCount: z.number(),
    })
  ),
});
export type Analytics = z.infer<typeof AnalyticsSchema>;
