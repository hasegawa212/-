import type { ToolDefinition } from "../aiServices/runTool";

export const codeExecutionTool: ToolDefinition = {
  name: "execute_code",
  description: "Execute JavaScript/TypeScript code in a sandboxed environment and return the result.",
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The JavaScript code to execute",
      },
      language: {
        type: "string",
        enum: ["javascript"],
        description: "Programming language (currently only javascript supported)",
      },
    },
    required: ["code"],
  },
  execute: async (args) => {
    const code = args.code as string;

    // Sanitize: block dangerous operations
    const blockedPatterns = [
      /require\s*\(/,
      /import\s+/,
      /process\./,
      /child_process/,
      /fs\./,
      /eval\s*\(/,
      /Function\s*\(/,
      /__dirname/,
      /__filename/,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(code)) {
        return {
          success: false,
          error: "Code contains blocked operations for security",
        };
      }
    }

    try {
      // Execute in a limited scope
      const wrappedCode = `
        "use strict";
        const console = { log: (...args) => output.push(args.map(String).join(' ')), warn: (...args) => output.push('WARN: ' + args.map(String).join(' ')), error: (...args) => output.push('ERROR: ' + args.map(String).join(' ')) };
        const output = [];
        const result = (() => { ${code} })();
        ({ result, output });
      `;

      const fn = new Function(wrappedCode);
      const { result, output } = fn();

      return {
        success: true,
        result: result !== undefined ? String(result) : undefined,
        output: output.length > 0 ? output : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Execution failed",
      };
    }
  },
};
