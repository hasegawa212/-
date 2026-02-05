import { streamChatCompletion } from "../_core/llm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export async function* streamPipeline(
  messages: ChatCompletionMessageParam[],
  options?: { model?: string; temperature?: number }
): AsyncGenerator<string> {
  for await (const chunk of streamChatCompletion(messages, options)) {
    yield chunk;
  }
}
