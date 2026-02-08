import { chatCompletion } from "../_core/llm";
import { retrieve } from "./retrieve";
import { rerank } from "./rerank";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export async function ragAnswer(
  query: string,
  options?: { model?: string; maxDocs?: number }
): Promise<{ answer: string; sources: Array<{ title: string; id: number }> }> {
  const results = await retrieve(query, options?.maxDocs || 3);
  const ranked = rerank(results, query);

  if (ranked.length === 0) {
    return { answer: "No relevant documents found.", sources: [] };
  }

  const context = ranked
    .map((r, i) => `[Document ${i + 1}: ${r.title}]\n${r.content}`)
    .join("\n\n---\n\n");

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `Answer the user's question based on the provided context. Cite sources when relevant. If the context doesn't contain enough information, say so.\n\nContext:\n${context}`,
    },
    { role: "user", content: query },
  ];

  const result = await chatCompletion(messages, {
    model: options?.model,
  });

  return {
    answer: result.content,
    sources: ranked.map((r) => ({ title: r.title, id: r.id })),
  };
}
