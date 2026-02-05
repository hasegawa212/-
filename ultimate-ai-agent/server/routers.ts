import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { db } from "./db";
import {
  conversations,
  messages,
  agents as agentsTable,
  ragDocuments,
  memoryEntries,
  workflows,
  analyticsEvents,
} from "../drizzle/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { processChat } from "./aiServices";
import { defaultAgents } from "./agents";
import { storeMemory, getMemories, deleteMemory } from "./aiServices/memory";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  // ===== Conversations =====
  conversations: router({
    list: publicProcedure.query(async () => {
      return db
        .select()
        .from(conversations)
        .orderBy(desc(conversations.updatedAt));
    }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const [conv] = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, input.id));
        return conv || null;
      }),

    create: publicProcedure
      .input(
        z.object({
          title: z.string().optional(),
          agentId: z.string().optional(),
          model: z.string().optional(),
          systemPrompt: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const [conv] = await db
          .insert(conversations)
          .values({
            title: input.title || "New Conversation",
            agentId: input.agentId || null,
            model: input.model || "gpt-4o-mini",
            systemPrompt: input.systemPrompt || null,
          })
          .returning();
        return conv;
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db
          .delete(conversations)
          .where(eq(conversations.id, input.id));
        return { success: true };
      }),
  }),

  // ===== Messages =====
  messages: router({
    list: publicProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        return db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .orderBy(messages.createdAt);
      }),
  }),

  // ===== Chat =====
  chat: router({
    send: publicProcedure
      .input(
        z.object({
          conversationId: z.number().optional(),
          message: z.string().min(1),
          agentId: z.string().optional(),
          model: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await processChat({
          conversationId: input.conversationId,
          message: input.message,
          agentId: input.agentId,
          model: input.model,
        });

        // Get the assistant message we just saved
        const msgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, result.conversationId))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        return {
          conversationId: result.conversationId,
          message: msgs[0],
          usage: result.usage,
        };
      }),
  }),

  // ===== Agents =====
  agents: router({
    list: publicProcedure.query(async () => {
      const dbAgents = await db.select().from(agentsTable);
      const mapped = dbAgents.map((a) => ({
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
    }),

    create: publicProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          systemPrompt: z.string(),
          model: z.string().default("gpt-4o-mini"),
          tools: z.array(z.string()).default([]),
          temperature: z.number().default(0.7),
          maxTokens: z.number().default(4096),
        })
      )
      .mutation(async ({ input }) => {
        const [agent] = await db
          .insert(agentsTable)
          .values({
            id: input.id,
            name: input.name,
            description: input.description,
            systemPrompt: input.systemPrompt,
            model: input.model,
            tools: input.tools,
            temperature: Math.round(input.temperature * 10),
            maxTokens: input.maxTokens,
          })
          .returning();
        return agent;
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.delete(agentsTable).where(eq(agentsTable.id, input.id));
        return { success: true };
      }),
  }),

  // ===== RAG Documents =====
  rag: router({
    list: publicProcedure.query(async () => {
      return db
        .select()
        .from(ragDocuments)
        .orderBy(desc(ragDocuments.createdAt));
    }),

    upload: publicProcedure
      .input(
        z.object({
          title: z.string(),
          content: z.string(),
          source: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const [doc] = await db
          .insert(ragDocuments)
          .values({
            title: input.title,
            content: input.content,
            source: input.source || null,
          })
          .returning();
        return doc;
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db
          .delete(ragDocuments)
          .where(eq(ragDocuments.id, input.id));
        return { success: true };
      }),
  }),

  // ===== Memory =====
  memory: router({
    list: publicProcedure
      .input(z.object({ conversationId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getMemories(input?.conversationId);
      }),

    store: publicProcedure
      .input(
        z.object({
          conversationId: z.number().nullable(),
          key: z.string(),
          value: z.string(),
          type: z.enum(["fact", "preference", "context"]).default("fact"),
        })
      )
      .mutation(async ({ input }) => {
        await storeMemory(input.conversationId, {
          key: input.key,
          value: input.value,
          type: input.type,
        });
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteMemory(input.id);
        return { success: true };
      }),
  }),

  // ===== Workflows =====
  workflows: router({
    list: publicProcedure.query(async () => {
      return db.select().from(workflows).orderBy(desc(workflows.createdAt));
    }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string(),
          steps: z.array(
            z.object({
              id: z.string(),
              type: z.string(),
              config: z.record(z.unknown()),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const [wf] = await db
          .insert(workflows)
          .values({
            name: input.name,
            description: input.description,
            steps: input.steps,
          })
          .returning();
        return wf;
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.delete(workflows).where(eq(workflows.id, input.id));
        return { success: true };
      }),
  }),

  // ===== Analytics =====
  analytics: router({
    summary: publicProcedure.query(async () => {
      const totalConversations = await db
        .select({ count: count() })
        .from(conversations);
      const totalMessages = await db
        .select({ count: count() })
        .from(messages);
      const tokenEvents = await db
        .select({
          total: sql<number>`COALESCE(SUM(tokens_used), 0)`,
        })
        .from(analyticsEvents);
      const avgResponse = await db
        .select({
          avg: sql<number>`COALESCE(AVG(response_time_ms), 0)`,
        })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventType, "chat_completion"));

      return {
        totalConversations: totalConversations[0]?.count || 0,
        totalMessages: totalMessages[0]?.count || 0,
        totalTokensUsed: tokenEvents[0]?.total || 0,
        averageResponseTime: Math.round(avgResponse[0]?.avg || 0),
        topAgents: [],
      };
    }),

    events: publicProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db
          .select()
          .from(analyticsEvents)
          .orderBy(desc(analyticsEvents.createdAt))
          .limit(input.limit);
      }),
  }),

  // ===== Health =====
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),
});

export type AppRouter = typeof appRouter;
