import type { NodeTypeDefinition, NodeTypeHandler } from "./index.js";

// ── Helper: safely evaluate a JS expression against data ─────────────
function evalCondition(condition: string, data: unknown): unknown {
  try {
    const fn = new Function("data", "return " + condition);
    return fn(data);
  } catch (err) {
    return false;
  }
}

// ── Logic: If (conditional) ─────────────────────────────────────────
export const handle_logic_if: NodeTypeHandler = async (config, inputs) => {
  const condition = (config.condition as string) || "true";
  const data = inputs.data ?? inputs;
  const result = evalCondition(condition, data);

  return {
    _branch: result ? "true" : "false",
    data,
  };
};

// ── Logic: Switch ───────────────────────────────────────────────────
export const handle_logic_switch: NodeTypeHandler = async (config, inputs) => {
  const cases = (config.cases as Array<{ value: string; label: string }>) || [];
  const value = inputs.value ?? inputs.data;

  const matched = cases.find(
    (c) => String(c.value) === String(value),
  );

  return {
    _branch: matched ? matched.label : "default",
    value,
  };
};

// ── Logic: Loop ─────────────────────────────────────────────────────
export const handle_logic_loop: NodeTypeHandler = async (
  config,
  inputs,
  context,
) => {
  const maxIterations = (config.maxIterations as number) ?? 1000;
  const inputArray = Array.isArray(inputs.data)
    ? inputs.data
    : Array.isArray(inputs.array)
      ? inputs.array
      : [];

  const items = inputArray.slice(0, maxIterations);
  const results: unknown[] = [];

  for (let i = 0; i < items.length; i++) {
    results.push({
      item: items[i],
      index: i,
      total: items.length,
    });
  }

  return results;
};

// ── Logic: Delay ────────────────────────────────────────────────────
export const handle_logic_delay: NodeTypeHandler = async (config, inputs) => {
  const seconds = (config.seconds as number) ?? 1;
  const clamped = Math.min(Math.max(seconds, 0), 300); // cap at 5 minutes
  await new Promise((resolve) => setTimeout(resolve, clamped * 1000));
  return inputs.data ?? inputs;
};

// ── Logic: Merge ────────────────────────────────────────────────────
export const handle_logic_merge: NodeTypeHandler = async (config, inputs) => {
  const mode = (config.mode as string) || "concat";
  const values = Object.values(inputs);

  switch (mode) {
    case "concat": {
      const arrays = values.map((v) => (Array.isArray(v) ? v : [v]));
      return arrays.flat();
    }
    case "zip": {
      const arrays = values.map((v) => (Array.isArray(v) ? v : [v]));
      const maxLen = Math.max(...arrays.map((a) => a.length));
      const result: unknown[][] = [];
      for (let i = 0; i < maxLen; i++) {
        result.push(arrays.map((a) => a[i]));
      }
      return result;
    }
    case "object": {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(inputs)) {
        result[key] = val;
      }
      return result;
    }
    default:
      return values;
  }
};

// ── Logic: Filter ───────────────────────────────────────────────────
export const handle_logic_filter: NodeTypeHandler = async (config, inputs) => {
  const condition = (config.condition as string) || "true";
  const inputArray = Array.isArray(inputs.data)
    ? inputs.data
    : Array.isArray(inputs.array)
      ? inputs.array
      : [];

  return inputArray.filter((item: unknown) => {
    try {
      const fn = new Function("data", "item", "return " + condition);
      return fn(item, item);
    } catch {
      return false;
    }
  });
};

// ── Logic: Error Handler (try/catch) ────────────────────────────────
export const handle_logic_error_handler: NodeTypeHandler = async (
  config,
  inputs,
  context,
) => {
  const fallbackValue = config.fallbackValue ?? null;

  try {
    // If the upstream data contains an error marker, use fallback
    if (inputs._error) {
      return fallbackValue;
    }
    return inputs.data ?? inputs;
  } catch {
    return fallbackValue;
  }
};

// ── Node-type definitions ───────────────────────────────────────────
export const logicNodeTypes: NodeTypeDefinition[] = [
  {
    type: "logic_if",
    label: "If Condition",
    category: "logic",
    description: "Branch workflow based on a condition",
    icon: "GitBranch",
    inputs: [
      {
        key: "condition",
        label: "Condition (JS expression)",
        type: "code",
        default: "data === true",
      },
    ],
    outputs: ["true", "false"],
    color: "#f59e0b",
  },
  {
    type: "logic_switch",
    label: "Switch",
    category: "logic",
    description: "Route to different branches based on a value",
    icon: "Route",
    inputs: [
      {
        key: "cases",
        label: "Cases (JSON array of {value, label})",
        type: "json",
        default: "[]",
      },
    ],
    outputs: ["default"],
    color: "#f59e0b",
  },
  {
    type: "logic_loop",
    label: "Loop",
    category: "logic",
    description: "Iterate over an array of items",
    icon: "Repeat",
    inputs: [
      {
        key: "maxIterations",
        label: "Max Iterations",
        type: "number",
        default: 1000,
      },
    ],
    outputs: ["item"],
    color: "#f59e0b",
  },
  {
    type: "logic_delay",
    label: "Delay",
    category: "logic",
    description: "Wait for a specified number of seconds",
    icon: "Timer",
    inputs: [
      { key: "seconds", label: "Seconds", type: "number", default: 1 },
    ],
    outputs: ["data"],
    color: "#f59e0b",
  },
  {
    type: "logic_merge",
    label: "Merge",
    category: "logic",
    description: "Merge multiple inputs into a single output",
    icon: "Merge",
    inputs: [
      {
        key: "mode",
        label: "Merge Mode",
        type: "select",
        default: "concat",
        options: ["concat", "zip", "object"],
      },
    ],
    outputs: ["merged"],
    color: "#f59e0b",
  },
  {
    type: "logic_filter",
    label: "Filter",
    category: "logic",
    description: "Filter an array based on a condition",
    icon: "Filter",
    inputs: [
      {
        key: "condition",
        label: "Condition (JS expression)",
        type: "code",
        default: "data !== null",
      },
    ],
    outputs: ["filtered"],
    color: "#f59e0b",
  },
  {
    type: "logic_error_handler",
    label: "Error Handler",
    category: "logic",
    description: "Catch errors and provide a fallback value",
    icon: "ShieldAlert",
    inputs: [
      {
        key: "fallbackValue",
        label: "Fallback Value (JSON)",
        type: "json",
        default: "null",
      },
    ],
    outputs: ["data"],
    color: "#f59e0b",
  },
];
