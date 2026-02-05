import { chatCompletion } from "../_core/llm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { executeTool, getAllTools } from "../aiServices/runTool";

interface AutonomousAgentConfig {
  systemPrompt: string;
  model?: string;
  maxIterations?: number;
}

export class AutonomousAgent {
  private config: AutonomousAgentConfig;
  private conversationHistory: ChatCompletionMessageParam[] = [];

  constructor(config: AutonomousAgentConfig) {
    this.config = config;
    this.conversationHistory.push({
      role: "system",
      content: config.systemPrompt,
    });
  }

  async run(
    task: string,
    onStep?: (step: string) => void
  ): Promise<string> {
    this.conversationHistory.push({ role: "user", content: task });

    const maxIterations = this.config.maxIterations || 5;

    for (let i = 0; i < maxIterations; i++) {
      const tools = getAllTools();
      const openaiTools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const result = await chatCompletion(this.conversationHistory, {
        model: this.config.model,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      if (result.toolCalls && result.toolCalls.length > 0) {
        // Execute tool calls
        this.conversationHistory.push({
          role: "assistant",
          content: result.content || null,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        } as ChatCompletionMessageParam);

        for (const tc of result.toolCalls) {
          onStep?.(`Calling tool: ${tc.name}`);
          try {
            const toolResult = await executeTool(tc.name, tc.arguments);
            this.conversationHistory.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(toolResult),
            } as ChatCompletionMessageParam);
          } catch (error) {
            this.conversationHistory.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            } as ChatCompletionMessageParam);
          }
        }
      } else {
        // No tool calls, we have a final response
        this.conversationHistory.push({
          role: "assistant",
          content: result.content,
        });
        return result.content;
      }
    }

    return "Max iterations reached. Task may be incomplete.";
  }
}
