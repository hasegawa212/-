import { registerBuiltinTools } from "../runtime/toolRegistry";
import { registerTool } from "../aiServices/runTool";
import { webSearchTool } from "./webSearch";
import { codeExecutionTool } from "./codeExecution";

export function initializeTools() {
  registerBuiltinTools();
  registerTool(webSearchTool);
  registerTool(codeExecutionTool);
  console.log("[Tools] All tools registered (built-in + web search + code execution)");
}
