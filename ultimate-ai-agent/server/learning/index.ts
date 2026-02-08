import { db } from "../db";
import { analyticsEvents, messages } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface LearningInsight {
  type: string;
  description: string;
  confidence: number;
  data: Record<string, unknown>;
}

// Analyze conversation patterns and extract insights
export async function analyzePatterns(): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = [];

  // Check most active time periods
  const events = await db
    .select()
    .from(analyticsEvents)
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(100);

  if (events.length > 0) {
    const avgTokens =
      events.reduce((sum, e) => sum + (e.tokensUsed || 0), 0) / events.length;
    insights.push({
      type: "usage_pattern",
      description: `Average token usage per request: ${Math.round(avgTokens)}`,
      confidence: 0.9,
      data: { avgTokens: Math.round(avgTokens), sampleSize: events.length },
    });

    const avgResponseTime =
      events.reduce((sum, e) => sum + (e.responseTimeMs || 0), 0) /
      events.length;
    insights.push({
      type: "performance",
      description: `Average response time: ${Math.round(avgResponseTime)}ms`,
      confidence: 0.9,
      data: {
        avgResponseTime: Math.round(avgResponseTime),
        sampleSize: events.length,
      },
    });
  }

  return insights;
}

// Get most common topics from messages
export async function getTopTopics(
  limit = 10
): Promise<Array<{ topic: string; count: number }>> {
  const recentMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.role, "user"))
    .orderBy(desc(messages.createdAt))
    .limit(100);

  // Simple word frequency analysis
  const wordCounts = new Map<string, number>();
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "can", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "it", "this",
    "that", "what", "how", "i", "me", "my", "you", "your",
  ]);

  for (const msg of recentMessages) {
    const words = msg.content
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}
