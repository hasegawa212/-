import { chatCompletion } from "../_core/llm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface PipelineStep {
  name: string;
  process: (input: string, context: PipelineContext) => Promise<string>;
}

export interface PipelineContext {
  conversationId?: number;
  agentId?: string;
  variables: Record<string, unknown>;
}

export class Pipeline {
  private steps: PipelineStep[] = [];

  addStep(step: PipelineStep): Pipeline {
    this.steps.push(step);
    return this;
  }

  async execute(input: string, context: PipelineContext): Promise<string> {
    let result = input;
    for (const step of this.steps) {
      result = await step.process(result, context);
    }
    return result;
  }
}

// Pre-built pipeline steps
export const preprocessStep: PipelineStep = {
  name: "preprocess",
  process: async (input) => input.trim(),
};

export const llmStep: PipelineStep = {
  name: "llm",
  process: async (input, context) => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: input },
    ];
    const result = await chatCompletion(messages);
    return result.content;
  },
};
