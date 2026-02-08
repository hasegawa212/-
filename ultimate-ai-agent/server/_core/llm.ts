import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
});

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: ChatCompletionTool[];
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export async function chatCompletion(
  messages: ChatCompletionMessageParam[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const {
    model = "gpt-4o-mini",
    temperature = 0.7,
    maxTokens = 4096,
    tools,
  } = options;

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(tools && tools.length > 0 ? { tools } : {}),
  });

  const choice = response.choices[0];
  const toolCalls = choice.message.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
  }));

  return {
    content: choice.message.content || "",
    toolCalls,
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
    finishReason: choice.finish_reason,
  };
}

export async function* streamChatCompletion(
  messages: ChatCompletionMessageParam[],
  options: LLMOptions = {}
): AsyncGenerator<string> {
  const {
    model = "gpt-4o-mini",
    temperature = 0.7,
    maxTokens = 4096,
  } = options;

  const stream = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

export { openai };
