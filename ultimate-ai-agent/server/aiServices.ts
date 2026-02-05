import { chatCompletion, streamChatCompletion } from "./_core/llm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { db } from "./db";
import { messages, conversations, analyticsEvents } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { defaultAgents, getAgentById } from "./agents";
import type { Agent } from "../shared/types";

export interface ChatOptions {
  conversationId?: number;
  message: string;
  agentId?: string;
  model?: string;
}

export interface ChatResult {
  conversationId: number;
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function processChat(options: ChatOptions): Promise<ChatResult> {
  const startTime = Date.now();
  const { message, agentId, model } = options;

  // Resolve agent
  const allAgents = await loadAllAgents();
  const agent = agentId ? getAgentById(allAgents, agentId) : allAgents[0];

  // Create or get conversation
  let conversationId = options.conversationId;
  if (!conversationId) {
    const [conv] = await db
      .insert(conversations)
      .values({
        title: message.slice(0, 80),
        agentId: agent?.id || null,
        model: model || agent?.model || "gpt-4o-mini",
      })
      .returning();
    conversationId = conv.id;
  }

  // Store user message
  await db.insert(messages).values({
    conversationId,
    role: "user",
    content: message,
  });

  // Load conversation history
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  // Build messages for LLM
  const llmMessages: ChatCompletionMessageParam[] = [];

  if (agent?.systemPrompt) {
    llmMessages.push({ role: "system", content: agent.systemPrompt });
  }

  for (const msg of history) {
    llmMessages.push({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    });
  }

  // Call LLM
  const result = await chatCompletion(llmMessages, {
    model: model || agent?.model,
    temperature: agent?.temperature,
    maxTokens: agent?.maxTokens,
  });

  // Store assistant response
  await db.insert(messages).values({
    conversationId,
    role: "assistant",
    content: result.content,
    metadata: result.usage ? JSON.stringify(result.usage) : null,
  });

  // Log analytics
  const responseTime = Date.now() - startTime;
  await db.insert(analyticsEvents).values({
    eventType: "chat_completion",
    conversationId,
    agentId: agent?.id,
    tokensUsed: result.usage?.totalTokens || 0,
    responseTimeMs: responseTime,
  });

  return {
    conversationId,
    response: result.content,
    usage: result.usage,
  };
}

export async function* streamChat(
  options: ChatOptions
): AsyncGenerator<{ type: string; data: string | number }> {
  const { message, agentId, model } = options;

  const allAgents = await loadAllAgents();
  const agent = agentId ? getAgentById(allAgents, agentId) : allAgents[0];

  let conversationId = options.conversationId;
  if (!conversationId) {
    const [conv] = await db
      .insert(conversations)
      .values({
        title: message.slice(0, 80),
        agentId: agent?.id || null,
        model: model || agent?.model || "gpt-4o-mini",
      })
      .returning();
    conversationId = conv.id;
  }

  yield { type: "conversationId", data: conversationId };

  await db.insert(messages).values({
    conversationId,
    role: "user",
    content: message,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  const llmMessages: ChatCompletionMessageParam[] = [];
  if (agent?.systemPrompt) {
    llmMessages.push({ role: "system", content: agent.systemPrompt });
  }
  for (const msg of history) {
    llmMessages.push({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    });
  }

  let fullResponse = "";
  for await (const chunk of streamChatCompletion(llmMessages, {
    model: model || agent?.model,
    temperature: agent?.temperature,
    maxTokens: agent?.maxTokens,
  })) {
    fullResponse += chunk;
    yield { type: "token", data: chunk };
  }

  await db.insert(messages).values({
    conversationId,
    role: "assistant",
    content: fullResponse,
  });

  yield { type: "done", data: fullResponse };
}

async function loadAllAgents(): Promise<Agent[]> {
  const dbAgents = await db.select().from(
    (await import("../drizzle/schema")).agents
  );

  const mapped: Agent[] = dbAgents.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    systemPrompt: a.systemPrompt,
    model: a.model,
    tools: (a.tools as string[]) || [],
    temperature: (a.temperature || 7) / 10,
    maxTokens: a.maxTokens,
    isActive: a.isActive,
  }));

  return [...defaultAgents, ...mapped];
}
