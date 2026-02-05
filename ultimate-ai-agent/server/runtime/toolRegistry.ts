import type { ToolDefinition } from "../aiServices/runTool";
import { registerTool } from "../aiServices/runTool";

// Built-in tools
const currentTimeToolDef: ToolDefinition = {
  name: "get_current_time",
  description: "Get the current date and time",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "IANA timezone (e.g., 'Asia/Tokyo')",
      },
    },
  },
  execute: async (args) => {
    const tz = (args.timezone as string) || "UTC";
    return new Date().toLocaleString("en-US", { timeZone: tz });
  },
};

const calculatorToolDef: ToolDefinition = {
  name: "calculator",
  description: "Perform basic mathematical calculations",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "Mathematical expression to evaluate",
      },
    },
    required: ["expression"],
  },
  execute: async (args) => {
    const expr = args.expression as string;
    // Basic safe math evaluation
    const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, "");
    try {
      return Function(`"use strict"; return (${sanitized})`)();
    } catch {
      throw new Error(`Invalid expression: ${expr}`);
    }
  },
};

export function registerBuiltinTools() {
  registerTool(currentTimeToolDef);
  registerTool(calculatorToolDef);
}
