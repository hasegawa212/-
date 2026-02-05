import { registerBuiltinTools } from "../runtime/toolRegistry";

// Initialize all built-in tools
export function initializeTools() {
  registerBuiltinTools();
  console.log("[Tools] Built-in tools registered");
}
