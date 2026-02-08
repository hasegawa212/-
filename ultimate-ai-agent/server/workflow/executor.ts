import type { ExecutionContext } from "./engine.js";

type NodeHandler = (
  config: Record<string, unknown>,
  inputs: Record<string, unknown>,
  context: ExecutionContext
) => Promise<unknown>;

const nodeHandlers = new Map<string, NodeHandler>();

function registerHandler(type: string, handler: NodeHandler) {
  nodeHandlers.set(type, handler);
}

registerHandler("trigger", async (_config, inputs) => {
  return inputs._variables ?? {};
});

registerHandler("http_request", async (config) => {
  const url = config.url as string;
  const method = (config.method as string) || "GET";
  const headers = (config.headers as Record<string, string>) || {};
  const body = config.body;

  const fetchOptions: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body && method !== "GET") {
    fetchOptions.body =
      typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const contentType = response.headers.get("content-type") || "";

  let data: unknown;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data,
  };
});

registerHandler("transform", async (config, inputs) => {
  const expression = config.expression as string;
  const inputData = Object.values(inputs).filter(
    (v) => v !== inputs._variables
  );
  const data = inputData.length === 1 ? inputData[0] : inputData;

  const fn = new Function(
    "data",
    "inputs",
    "variables",
    `return (${expression})`
  );
  return fn(data, inputs, inputs._variables);
});

registerHandler("condition", async (config, inputs) => {
  const expression = config.expression as string;
  const inputData = Object.values(inputs).filter(
    (v) => v !== inputs._variables
  );
  const data = inputData.length === 1 ? inputData[0] : inputData;

  const fn = new Function(
    "data",
    "variables",
    `return !!(${expression})`
  );
  const result = fn(data, inputs._variables);

  return { result, branch: result ? "true" : "false", data };
});

registerHandler("loop", async (config, inputs, context) => {
  const items = config.items as unknown[] | undefined;
  const inputData = Object.values(inputs).filter(
    (v) => v !== inputs._variables
  );
  const iterable =
    items ?? (Array.isArray(inputData[0]) ? inputData[0] : inputData);

  const results: unknown[] = [];
  for (const item of iterable as unknown[]) {
    results.push(item);
  }

  return { items: results, count: results.length };
});

registerHandler("ai_prompt", async (config) => {
  const { chatCompletion } = await import("../_core/llm.js");

  const prompt = config.prompt as string;
  const systemPrompt = config.systemPrompt as string | undefined;
  const model = config.model as string | undefined;

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await chatCompletion(messages, { model });
  return { content: response.content, usage: response.usage };
});

registerHandler("code", async (config, inputs) => {
  const code = config.code as string;
  const inputData = Object.values(inputs).filter(
    (v) => v !== inputs._variables
  );
  const data = inputData.length === 1 ? inputData[0] : inputData;

  const fn = new Function("data", "inputs", "variables", code);
  return fn(data, inputs, inputs._variables);
});

registerHandler("delay", async (config) => {
  const ms = (config.ms as number) || 1000;
  await new Promise((resolve) => setTimeout(resolve, ms));
  return { delayed: ms };
});

registerHandler("set_variable", async (config, _inputs, context) => {
  const name = config.name as string;
  const value = config.value;
  context.variables[name] = value;
  return { [name]: value };
});

registerHandler("merge", async (_config, inputs) => {
  const entries = Object.entries(inputs).filter(([k]) => k !== "_variables");
  const merged: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    merged[key] = value;
  }
  return merged;
});

registerHandler("filter", async (config, inputs) => {
  const expression = config.expression as string;
  const inputData = Object.values(inputs).filter(
    (v) => v !== inputs._variables
  );
  const data = inputData[0];

  if (!Array.isArray(data)) return { filtered: [], count: 0 };

  const fn = new Function("item", "index", `return (${expression})`);
  const filtered = data.filter((item, index) => fn(item, index));

  return { filtered, count: filtered.length };
});

registerHandler("webhook_response", async (config, inputs) => {
  const statusCode = (config.statusCode as number) || 200;
  const inputData = Object.values(inputs).filter(
    (v) => v !== inputs._variables
  );
  const body = inputData.length === 1 ? inputData[0] : inputData;

  return { statusCode, body };
});

export async function executeNodeByType(
  nodeType: string,
  config: Record<string, unknown>,
  inputs: Record<string, unknown>,
  context: ExecutionContext,
  timeoutMs: number = 30000
): Promise<unknown> {
  const handler = nodeHandlers.get(nodeType);
  if (!handler) {
    throw new Error(`Unknown node type: ${nodeType}`);
  }

  const startTime = Date.now();

  const result = await Promise.race([
    handler(config, inputs, context),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Node timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);

  const duration = Date.now() - startTime;
  return { _output: result, _duration: duration, _type: nodeType };
}

export function getRegisteredNodeTypes(): string[] {
  return Array.from(nodeHandlers.keys());
}
