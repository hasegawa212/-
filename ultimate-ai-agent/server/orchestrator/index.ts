import { runAgent } from "../aiServices/runAgent";
import type { Agent } from "../../shared/types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

interface OrchestratorTask {
  agent: Agent;
  messages: ChatCompletionMessageParam[];
  priority?: number;
}

interface OrchestratorResult {
  agentId: string;
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class MultiAgentOrchestrator {
  private tasks: OrchestratorTask[] = [];

  addTask(task: OrchestratorTask): void {
    this.tasks.push(task);
  }

  async executeSequential(): Promise<OrchestratorResult[]> {
    const results: OrchestratorResult[] = [];
    const sorted = [...this.tasks].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    for (const task of sorted) {
      const result = await runAgent(task.agent, task.messages);
      results.push({
        agentId: task.agent.id,
        response: result.response,
        usage: result.usage,
      });
    }

    return results;
  }

  async executeParallel(): Promise<OrchestratorResult[]> {
    const promises = this.tasks.map(async (task) => {
      const result = await runAgent(task.agent, task.messages);
      return {
        agentId: task.agent.id,
        response: result.response,
        usage: result.usage,
      };
    });

    return Promise.all(promises);
  }

  clear(): void {
    this.tasks = [];
  }
}
