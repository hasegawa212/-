import { chatCompletion } from "../_core/llm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Agent } from "../../shared/types";

export interface AgentRunResult {
  response: string;
  toolResults?: Array<{
    toolName: string;
    result: unknown;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function runAgent(
  agent: Agent,
  messages: ChatCompletionMessageParam[]
): Promise<AgentRunResult> {
  const llmMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: agent.systemPrompt },
    ...messages,
  ];

  const result = await chatCompletion(llmMessages, {
    model: agent.model,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
  });

  return {
    response: result.content,
    usage: result.usage,
  };
}
