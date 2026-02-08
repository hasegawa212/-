import type { RetrievalResult } from "./retrieve";

export function rerank(
  results: RetrievalResult[],
  query: string
): RetrievalResult[] {
  // Simple re-ranking: boost results where title matches query
  const queryLower = query.toLowerCase();
  return results
    .map((r) => ({
      ...r,
      score: r.score + (r.title.toLowerCase().includes(queryLower) ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score);
}
