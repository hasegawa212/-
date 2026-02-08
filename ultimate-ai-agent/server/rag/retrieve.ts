import { db } from "../db";
import { ragDocuments } from "../../drizzle/schema";
import { like } from "drizzle-orm";

export interface RetrievalResult {
  id: number;
  title: string;
  content: string;
  score: number;
}

// Simple keyword-based retrieval (can be upgraded to vector search)
export async function retrieve(
  query: string,
  limit = 5
): Promise<RetrievalResult[]> {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const allDocs = await db.select().from(ragDocuments);

  const scored = allDocs
    .map((doc) => {
      const text = `${doc.title} ${doc.content}`.toLowerCase();
      const score = keywords.reduce((s, kw) => {
        return s + (text.includes(kw) ? 1 : 0);
      }, 0);
      return { ...doc, score };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((d) => ({
    id: d.id,
    title: d.title,
    content: d.content,
    score: d.score / keywords.length,
  }));
}
