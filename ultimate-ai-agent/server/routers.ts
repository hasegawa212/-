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
import { defaultAgents, promptTemplates } from "./agents";
import { storeMemory, getMemories, deleteMemory } from "./aiServices/memory";
import { calculateValuation } from "./bankValuation/calculator";
import {
  STRUCTURE_PROFILES,
  PROPERTY_PROFILES,
  AREA_PROFILES,
  BANK_PROFILES,
} from "./bankValuation/constants";
import {
  ValuationInputSchema,
  CreateDealSchema,
  RecordActualSchema,
  type Deal,
} from "../shared/types";
import { bankValuationDeals } from "../drizzle/schema";
import {
  getCalibrations,
  listCalibrations,
  recomputeAllCalibrations,
  recomputeCalibrationFor,
  MIN_SAMPLES_FOR_CALIBRATION,
} from "./bankValuation/calibration";
import { lookupRosenka } from "./bankValuation/rosenkaLookup";
import { simulateLoanFull } from "./loanSimulator/simulator";
import { LoanSimulationInputSchema } from "../shared/types";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

// ----- Deal helpers -----
function deserializeDeal(r: typeof bankValuationDeals.$inferSelect): Deal {
  return {
    id: r.id,
    dealCode: r.dealCode,
    title: r.title,
    input: typeof r.inputJson === "string" ? JSON.parse(r.inputJson) : r.inputJson,
    result: typeof r.resultJson === "string" ? JSON.parse(r.resultJson) : r.resultJson,
    actualBankId: r.actualBankId,
    actualBankName: r.actualBankName,
    actualValuationYen: r.actualValuationYen,
    actualLoanYen: r.actualLoanYen,
    actualInterestRatePercent:
      r.actualInterestRateX100 === null || r.actualInterestRateX100 === undefined
        ? null
        : r.actualInterestRateX100 / 100,
    dealStatus: r.dealStatus,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function generateDealCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEAL-${year}-`;
  const existing = await db
    .select({ code: bankValuationDeals.dealCode })
    .from(bankValuationDeals);
  const seqs = existing
    .map((r) => r.code)
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = seqs.length === 0 ? 1 : Math.max(...seqs) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

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

  // ===== Prompt Templates =====
  promptTemplates: router({
    list: publicProcedure.query(() => {
      return promptTemplates;
    }),
  }),

  // ===== Conversations Search =====
  search: router({
    messages: publicProcedure
      .input(z.object({ query: z.string().min(1), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const allMessages = await db
          .select()
          .from(messages)
          .orderBy(desc(messages.createdAt))
          .limit(500);
        const filtered = allMessages.filter((m) =>
          m.content.toLowerCase().includes(input.query.toLowerCase())
        );
        return filtered.slice(0, input.limit);
      }),

    conversations: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const allConvs = await db
          .select()
          .from(conversations)
          .orderBy(desc(conversations.updatedAt));
        return allConvs.filter((c) =>
          c.title.toLowerCase().includes(input.query.toLowerCase())
        );
      }),
  }),

  // ===== 銀行評価額シミュレーター =====
  bankValuation: router({
    metadata: publicProcedure.query(() => ({
      structures: Object.entries(STRUCTURE_PROFILES).map(([id, p]) => ({
        id,
        label: p.label,
        legalLifeYears: p.legalLifeYears,
        replacementCostPerSqm: p.replacementCostPerSqm,
      })),
      propertyTypes: Object.entries(PROPERTY_PROFILES).map(([id, p]) => ({
        id,
        label: p.label,
        defaultCapRate: p.defaultCapRate,
        appliesIncomeApproach: p.appliesIncomeApproach,
      })),
      areaTiers: Object.entries(AREA_PROFILES).map(([id, p]) => ({
        id,
        label: p.label,
      })),
      banks: BANK_PROFILES.map((b) => ({
        id: b.id,
        label: b.label,
        category: b.category,
        loanToValueRatio: b.loanToValueRatio,
      })),
    })),
    calculate: publicProcedure
      .input(ValuationInputSchema)
      .mutation(async ({ input }) => {
        const calibrations = await getCalibrations();
        return calculateValuation(input, calibrations);
      }),
    // ★ PR #16: 住所から路線価を推定
    lookupRosenka: publicProcedure
      .input(z.object({ address: z.string() }))
      .query(({ input }) => {
        return lookupRosenka(input.address);
      }),
  }),

  // ===== 銀行プロファイル校正（学習結果） =====
  bankCalibration: router({
    list: publicProcedure.query(async () => {
      const items = await listCalibrations();
      return {
        minSamples: MIN_SAMPLES_FOR_CALIBRATION,
        items,
      };
    }),
    recomputeAll: publicProcedure.mutation(async () => {
      return await recomputeAllCalibrations();
    }),
  }),

  // ===== 案件保存・実績記録 =====
  bankValuationDeals: router({
    list: publicProcedure.query(async () => {
      const rows = await db
        .select()
        .from(bankValuationDeals)
        .orderBy(desc(bankValuationDeals.updatedAt));
      return rows.map((r) => deserializeDeal(r));
    }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const rows = await db
          .select()
          .from(bankValuationDeals)
          .where(eq(bankValuationDeals.id, input.id))
          .limit(1);
        if (rows.length === 0) throw new Error("Deal not found");
        return deserializeDeal(rows[0]);
      }),

    create: publicProcedure
      .input(CreateDealSchema)
      .mutation(async ({ input }) => {
        const dealCode = input.dealCode ?? (await generateDealCode());
        const inserted = await db
          .insert(bankValuationDeals)
          .values({
            dealCode,
            title: input.title,
            inputJson: JSON.stringify(input.input) as unknown as object,
            resultJson: JSON.stringify(input.result) as unknown as object,
            note: input.note,
          })
          .returning();
        return deserializeDeal(inserted[0]);
      }),

    recordActual: publicProcedure
      .input(RecordActualSchema)
      .mutation(async ({ input }) => {
        const updates: Record<string, unknown> = {
          updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
        };
        if (input.actualBankId !== undefined) updates.actualBankId = input.actualBankId;
        if (input.actualBankName !== undefined) updates.actualBankName = input.actualBankName;
        if (input.actualValuationYen !== undefined)
          updates.actualValuationYen = input.actualValuationYen;
        if (input.actualLoanYen !== undefined) updates.actualLoanYen = input.actualLoanYen;
        if (input.actualInterestRatePercent !== undefined)
          updates.actualInterestRateX100 =
            input.actualInterestRatePercent === null
              ? null
              : Math.round(input.actualInterestRatePercent * 100);
        if (input.dealStatus !== undefined) updates.dealStatus = input.dealStatus;
        if (input.note !== undefined) updates.note = input.note;

        const updated = await db
          .update(bankValuationDeals)
          .set(updates)
          .where(eq(bankValuationDeals.id, input.id))
          .returning();
        if (updated.length === 0) throw new Error("Deal not found");

        // 実績が更新されたら校正を再計算（該当銀行のみ）
        const deal = updated[0];
        if (deal.actualBankId) {
          await recomputeCalibrationFor(deal.actualBankId).catch(() => {
            // 校正失敗は致命的でないため握り潰す（ログだけ）
            console.warn("recomputeCalibrationFor failed for", deal.actualBankId);
          });
        }

        return deserializeDeal(updated[0]);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.delete(bankValuationDeals).where(eq(bankValuationDeals.id, input.id));
        return { ok: true };
      }),
  }),

  // ===== 住宅ローン シミュレーター（実銀行データ + 否決パターン学習） =====
  loanSimulator: router({
    simulate: publicProcedure
      .input(LoanSimulationInputSchema)
      .mutation(({ input }) => {
        return simulateLoanFull(input);
      }),
  }),

  // ===== Health =====
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),
});

export type AppRouter = typeof appRouter;
