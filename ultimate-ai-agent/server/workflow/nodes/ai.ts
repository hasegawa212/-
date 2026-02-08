import OpenAI from "openai";
import type { NodeTypeDefinition, NodeTypeHandler } from "./index.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// ── Helper: call chat completions ────────────────────────────────────
async function llmChat(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  model = "gpt-4o-mini",
  temperature = 0.7,
  maxTokens = 4096,
): Promise<string> {
  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  return response.choices[0]?.message?.content ?? "";
}

// ── AI: LLM Completion ──────────────────────────────────────────────
export const handle_ai_llm: NodeTypeHandler = async (config, inputs) => {
  const model = (config.model as string) || "gpt-4o-mini";
  const systemPrompt = (config.systemPrompt as string) || "";
  const temperature = (config.temperature as number) ?? 0.7;
  const maxTokens = (config.maxTokens as number) ?? 4096;
  const prompt = (inputs.prompt as string) || (inputs.data as string) || "";

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const response = await llmChat(messages, model, temperature, maxTokens);
  return response;
};

// ── AI: Multi-turn Chat ─────────────────────────────────────────────
export const handle_ai_chat: NodeTypeHandler = async (config, inputs) => {
  const model = (config.model as string) || "gpt-4o-mini";
  const systemPrompt = (config.systemPrompt as string) || "";
  const rawMessages = (inputs.messages as unknown[]) || [];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

  for (const msg of rawMessages) {
    if (
      typeof msg === "object" &&
      msg !== null &&
      "role" in msg &&
      "content" in msg
    ) {
      messages.push(
        msg as OpenAI.Chat.Completions.ChatCompletionMessageParam,
      );
    }
  }

  const response = await llmChat(messages, model);
  return response;
};

// ── AI: Summarize ───────────────────────────────────────────────────
export const handle_ai_summarize: NodeTypeHandler = async (config, inputs) => {
  const maxLength = (config.maxLength as number) ?? 200;
  const style = (config.style as string) || "paragraph";
  const text = (inputs.text as string) || (inputs.data as string) || "";

  const styleInstruction =
    style === "bullet"
      ? "Summarize the following text as concise bullet points."
      : "Summarize the following text in a concise paragraph.";

  const prompt = `${styleInstruction} Keep the summary under ${maxLength} words.\n\n${text}`;
  const summary = await llmChat([{ role: "user", content: prompt }]);
  return summary;
};

// ── AI: Classify ────────────────────────────────────────────────────
export const handle_ai_classify: NodeTypeHandler = async (config, inputs) => {
  const categories = (config.categories as string[]) || [];
  const text = (inputs.text as string) || (inputs.data as string) || "";

  const prompt = `Classify the following text into exactly one of these categories: ${categories.join(", ")}.

Respond with ONLY a JSON object in this format: {"category": "<chosen category>", "confidence": <0-1 number>}

Text: ${text}`;

  const raw = await llmChat([{ role: "user", content: prompt }]);
  try {
    return JSON.parse(raw);
  } catch {
    return { category: raw.trim(), confidence: 0 };
  }
};

// ── AI: Extract structured data ─────────────────────────────────────
export const handle_ai_extract: NodeTypeHandler = async (config, inputs) => {
  const schema = (config.schema as string) || "{}";
  const text = (inputs.text as string) || (inputs.data as string) || "";

  const prompt = `Extract structured data from the following text according to this JSON schema:

Schema: ${schema}

Text: ${text}

Respond with ONLY the extracted JSON object, no extra text.`;

  const raw = await llmChat([{ role: "user", content: prompt }]);
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
};

// ── AI: Translate ───────────────────────────────────────────────────
export const handle_ai_translate: NodeTypeHandler = async (config, inputs) => {
  const targetLanguage = (config.targetLanguage as string) || "English";
  const text = (inputs.text as string) || (inputs.data as string) || "";

  const prompt = `Translate the following text to ${targetLanguage}. Respond with ONLY the translated text, no explanations.\n\n${text}`;
  const translated = await llmChat([{ role: "user", content: prompt }]);
  return translated;
};

// ── AI: Sentiment Analysis ──────────────────────────────────────────
export const handle_ai_sentiment: NodeTypeHandler = async (_config, inputs) => {
  const text = (inputs.text as string) || (inputs.data as string) || "";

  const prompt = `Analyze the sentiment of the following text.
Respond with ONLY a JSON object: {"sentiment": "positive"|"negative"|"neutral"|"mixed", "score": <-1 to 1 number>}

Text: ${text}`;

  const raw = await llmChat([{ role: "user", content: prompt }]);
  try {
    return JSON.parse(raw);
  } catch {
    return { sentiment: "neutral", score: 0 };
  }
};

// ── AI: Embedding ───────────────────────────────────────────────────
export const handle_ai_embedding: NodeTypeHandler = async (config, inputs) => {
  const model = (config.model as string) || "text-embedding-3-small";
  const text = (inputs.text as string) || (inputs.data as string) || "";

  const response = await openai.embeddings.create({
    model,
    input: text,
  });

  return response.data[0]?.embedding ?? [];
};

// ── Node-type definitions ───────────────────────────────────────────
export const aiNodeTypes: NodeTypeDefinition[] = [
  {
    type: "ai_llm",
    label: "LLM Completion",
    category: "ai",
    description: "Generate text using a large language model",
    icon: "Brain",
    inputs: [
      {
        key: "model",
        label: "Model",
        type: "select",
        default: "gpt-4o-mini",
        options: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
      },
      {
        key: "systemPrompt",
        label: "System Prompt",
        type: "code",
        default: "",
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "number",
        default: 0.7,
      },
      { key: "maxTokens", label: "Max Tokens", type: "number", default: 4096 },
    ],
    outputs: ["response"],
    color: "#8b5cf6",
  },
  {
    type: "ai_chat",
    label: "Multi-turn Chat",
    category: "ai",
    description: "Continue a multi-turn conversation with an LLM",
    icon: "MessagesSquare",
    inputs: [
      {
        key: "model",
        label: "Model",
        type: "select",
        default: "gpt-4o-mini",
        options: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
      },
      {
        key: "systemPrompt",
        label: "System Prompt",
        type: "code",
        default: "",
      },
    ],
    outputs: ["response"],
    color: "#8b5cf6",
  },
  {
    type: "ai_summarize",
    label: "Summarize Text",
    category: "ai",
    description: "Summarize long text into a shorter version",
    icon: "FileText",
    inputs: [
      { key: "maxLength", label: "Max Words", type: "number", default: 200 },
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "paragraph",
        options: ["bullet", "paragraph"],
      },
    ],
    outputs: ["summary"],
    color: "#8b5cf6",
  },
  {
    type: "ai_classify",
    label: "Classify Text",
    category: "ai",
    description: "Classify text into predefined categories",
    icon: "Tags",
    inputs: [
      { key: "categories", label: "Categories (JSON array)", type: "json", default: "[]" },
    ],
    outputs: ["category", "confidence"],
    color: "#8b5cf6",
  },
  {
    type: "ai_extract",
    label: "Extract Data",
    category: "ai",
    description: "Extract structured data from text using a JSON schema",
    icon: "Database",
    inputs: [
      { key: "schema", label: "JSON Schema", type: "json", default: "{}" },
    ],
    outputs: ["extracted"],
    color: "#8b5cf6",
  },
  {
    type: "ai_translate",
    label: "Translate Text",
    category: "ai",
    description: "Translate text to a target language",
    icon: "Languages",
    inputs: [
      {
        key: "targetLanguage",
        label: "Target Language",
        type: "string",
        default: "English",
      },
    ],
    outputs: ["translated"],
    color: "#8b5cf6",
  },
  {
    type: "ai_sentiment",
    label: "Sentiment Analysis",
    category: "ai",
    description: "Analyze the sentiment of text",
    icon: "Heart",
    inputs: [],
    outputs: ["sentiment", "score"],
    color: "#8b5cf6",
  },
  {
    type: "ai_embedding",
    label: "Generate Embedding",
    category: "ai",
    description: "Generate a vector embedding for text",
    icon: "Binary",
    inputs: [
      {
        key: "model",
        label: "Embedding Model",
        type: "select",
        default: "text-embedding-3-small",
        options: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
      },
    ],
    outputs: ["vector"],
    color: "#8b5cf6",
  },
];
