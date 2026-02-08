import { chatCompletion } from "../_core/llm.js";
import type { WorkflowDefinition } from "./engine.js";
import { getRegisteredNodeTypes } from "./executor.js";

const SYSTEM_PROMPT = `You are a workflow builder AI. You convert natural language descriptions into structured workflow definitions (JSON).

Available node types and their configs:

- trigger: Starting point. Config: {} (receives trigger data automatically)
- http_request: Makes HTTP requests. Config: { url: string, method: "GET"|"POST"|"PUT"|"DELETE", headers?: object, body?: any }
- transform: Transforms data with a JS expression. Config: { expression: string } (expression receives "data" and "variables")
- condition: Branches based on a condition. Config: { expression: string } (returns { result: boolean, branch: "true"|"false", data })
- loop: Iterates over an array. Config: { items?: array } (or receives array from input)
- ai_prompt: Sends a prompt to an LLM. Config: { prompt: string, systemPrompt?: string, model?: string }
- code: Executes custom JavaScript. Config: { code: string } (code receives "data", "inputs", "variables"; must return a value)
- delay: Waits for a specified time. Config: { ms: number }
- set_variable: Sets a workflow variable. Config: { name: string, value: any }
- merge: Merges multiple inputs into one object. Config: {}
- filter: Filters an array. Config: { expression: string } (expression receives "item" and "index")
- webhook_response: Returns a response from a webhook-triggered workflow. Config: { statusCode?: number }

Rules for building workflows:
1. Every workflow must start with a "trigger" node.
2. Nodes are connected via edges. Each edge has: id, source (node id), target (node id).
3. For conditional branches, use sourceHandle "true" or "false" on edges from condition nodes.
4. Position nodes in a visual grid: x increments by 250 for each column, y increments by 150 for each row.
5. Give each node a unique id like "node_1", "node_2", etc.
6. Give each edge a unique id like "edge_1", "edge_2", etc.
7. The workflow id should be a UUID-like string.
8. Always include sensible default settings.

Respond with ONLY valid JSON matching this TypeScript interface:

interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: Array<{ id: string; type: string; label: string; config: Record<string, unknown>; position: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; condition?: string }>;
  variables: Record<string, unknown>;
  settings: { errorHandling: "stop" | "skip" | "retry"; maxRetries: number; timeout: number };
}

Do NOT include any markdown formatting, code fences, or explanation. Output raw JSON only.`;

export async function buildWorkflowFromDescription(
  description: string
): Promise<WorkflowDefinition> {
  const availableTypes = getRegisteredNodeTypes();

  const userPrompt = [
    `Available node types in this system: ${availableTypes.join(", ")}`,
    "",
    `Build a workflow for the following description:`,
    "",
    description,
  ].join("\n");

  const response = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    {
      model: "gpt-4o",
      temperature: 0.3,
      maxTokens: 4096,
    }
  );

  const content = response.content.trim();

  let json: string;
  if (content.startsWith("```")) {
    const lines = content.split("\n");
    json = lines.slice(1, -1).join("\n");
  } else {
    json = content;
  }

  let workflow: WorkflowDefinition;
  try {
    workflow = JSON.parse(json) as WorkflowDefinition;
  } catch {
    throw new Error(
      `Failed to parse workflow JSON from AI response: ${content.slice(0, 200)}`
    );
  }

  validateWorkflow(workflow);

  return workflow;
}

function validateWorkflow(workflow: WorkflowDefinition) {
  if (!workflow.id || typeof workflow.id !== "string") {
    throw new Error("Workflow must have a string id");
  }
  if (!workflow.name || typeof workflow.name !== "string") {
    throw new Error("Workflow must have a string name");
  }
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    throw new Error("Workflow must have at least one node");
  }
  if (!Array.isArray(workflow.edges)) {
    throw new Error("Workflow edges must be an array");
  }

  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  const hasTrigger = workflow.nodes.some((n) => n.type === "trigger");
  if (!hasTrigger) {
    throw new Error("Workflow must contain a trigger node");
  }

  for (const node of workflow.nodes) {
    if (!node.id || !node.type || !node.label) {
      throw new Error(`Node is missing required fields: ${JSON.stringify(node)}`);
    }
    if (!node.position || typeof node.position.x !== "number" || typeof node.position.y !== "number") {
      throw new Error(`Node ${node.id} is missing valid position`);
    }
  }

  for (const edge of workflow.edges) {
    if (!edge.id || !edge.source || !edge.target) {
      throw new Error(`Edge is missing required fields: ${JSON.stringify(edge)}`);
    }
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge ${edge.id} references unknown source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge ${edge.id} references unknown target node: ${edge.target}`);
    }
  }

  if (!workflow.settings) {
    workflow.settings = {
      errorHandling: "stop",
      maxRetries: 3,
      timeout: 30000,
    };
  }

  if (!workflow.variables) {
    workflow.variables = {};
  }
}
