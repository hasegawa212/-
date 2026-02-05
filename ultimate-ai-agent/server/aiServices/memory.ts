import { db } from "../db";
import { memoryEntries } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface MemoryEntry {
  key: string;
  value: string;
  type: "fact" | "preference" | "context";
}

export async function storeMemory(
  conversationId: number | null,
  entry: MemoryEntry
) {
  return db.insert(memoryEntries).values({
    conversationId,
    key: entry.key,
    value: entry.value,
    type: entry.type,
  });
}

export async function getMemories(conversationId?: number) {
  if (conversationId) {
    return db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.conversationId, conversationId));
  }
  return db.select().from(memoryEntries);
}

export async function deleteMemory(id: number) {
  return db.delete(memoryEntries).where(eq(memoryEntries.id, id));
}

export async function getMemoryContext(
  conversationId: number
): Promise<string> {
  const memories = await db
    .select()
    .from(memoryEntries)
    .where(eq(memoryEntries.conversationId, conversationId));

  if (memories.length === 0) return "";

  const lines = memories.map((m) => `- ${m.key}: ${m.value}`);
  return `Relevant context from memory:\n${lines.join("\n")}`;
}
