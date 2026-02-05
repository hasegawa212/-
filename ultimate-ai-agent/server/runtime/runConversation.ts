import { db } from "../db";
import { messages, conversations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { processChat } from "../aiServices";

export async function runConversation(
  conversationId: number,
  userMessage: string,
  options?: { agentId?: string; model?: string }
) {
  return processChat({
    conversationId,
    message: userMessage,
    agentId: options?.agentId,
    model: options?.model,
  });
}

export async function getConversationHistory(conversationId: number) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}
