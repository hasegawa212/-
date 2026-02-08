import type { NodeTypeDefinition, NodeTypeHandler } from "./index.js";

// ── Data: Transform with JS expression ──────────────────────────────
export const handle_data_transform: NodeTypeHandler = async (
  config,
  inputs,
) => {
  const expression = (config.expression as string) || "data";
  const data = inputs.data ?? inputs;

  try {
    const fn = new Function("data", "return " + expression);
    return fn(data);
  } catch (err) {
    throw new Error(
      `Transform expression error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

// ── Data: String Template ───────────────────────────────────────────
export const handle_data_template: NodeTypeHandler = async (
  config,
  inputs,
) => {
  const template = (config.template as string) || "";
  const variables =
    typeof inputs.data === "object" && inputs.data !== null
      ? (inputs.data as Record<string, unknown>)
      : (inputs as Record<string, unknown>);

  // Replace {{key}} with variable values, supporting nested dot notation
  const rendered = template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key: string) => {
    const parts = key.split(".");
    let value: unknown = variables;
    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return "";
      }
    }
    return String(value ?? "");
  });

  return rendered;
};

// ── Data: JSON Parse ────────────────────────────────────────────────
export const handle_data_json_parse: NodeTypeHandler = async (
  _config,
  inputs,
) => {
  const raw = (inputs.data as string) || (inputs.text as string) || "";
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

// ── Data: JSON Stringify ────────────────────────────────────────────
export const handle_data_json_stringify: NodeTypeHandler = async (
  config,
  inputs,
) => {
  const pretty = (config.pretty as boolean) ?? false;
  const data = inputs.data ?? inputs;
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
};

// ── Data: Split Text ────────────────────────────────────────────────
export const handle_data_split: NodeTypeHandler = async (config, inputs) => {
  const delimiter = (config.delimiter as string) ?? ",";
  const text = (inputs.data as string) || (inputs.text as string) || "";
  return text.split(delimiter);
};

// ── Data: Aggregate ─────────────────────────────────────────────────
export const handle_data_aggregate: NodeTypeHandler = async (
  config,
  inputs,
) => {
  const operation = (config.operation as string) || "count";
  const inputArray = Array.isArray(inputs.data)
    ? inputs.data
    : Array.isArray(inputs.array)
      ? inputs.array
      : [];

  switch (operation) {
    case "sum": {
      return inputArray.reduce(
        (acc: number, item: unknown) => acc + Number(item),
        0,
      );
    }
    case "avg": {
      if (inputArray.length === 0) return 0;
      const sum = inputArray.reduce(
        (acc: number, item: unknown) => acc + Number(item),
        0,
      );
      return sum / inputArray.length;
    }
    case "min": {
      const nums = inputArray.map(Number).filter((n: number) => !isNaN(n));
      return nums.length > 0 ? Math.min(...nums) : null;
    }
    case "max": {
      const nums = inputArray.map(Number).filter((n: number) => !isNaN(n));
      return nums.length > 0 ? Math.max(...nums) : null;
    }
    case "count": {
      return inputArray.length;
    }
    case "concat": {
      return inputArray.map(String).join("");
    }
    default:
      return inputArray.length;
  }
};

// ── Node-type definitions ───────────────────────────────────────────
export const dataNodeTypes: NodeTypeDefinition[] = [
  {
    type: "data_transform",
    label: "Transform Data",
    category: "data",
    description: "Transform data using a JavaScript expression",
    icon: "Wand2",
    inputs: [
      {
        key: "expression",
        label: "JS Expression",
        type: "code",
        default: "data",
      },
    ],
    outputs: ["result"],
    color: "#10b981",
  },
  {
    type: "data_template",
    label: "String Template",
    category: "data",
    description: "Render a string template with variable substitution",
    icon: "FileCode",
    inputs: [
      {
        key: "template",
        label: "Template",
        type: "string",
        default: "Hello {{name}}",
      },
    ],
    outputs: ["result"],
    color: "#10b981",
  },
  {
    type: "data_json_parse",
    label: "Parse JSON",
    category: "data",
    description: "Parse a JSON string into an object",
    icon: "Braces",
    inputs: [],
    outputs: ["result"],
    color: "#10b981",
  },
  {
    type: "data_json_stringify",
    label: "Stringify JSON",
    category: "data",
    description: "Convert an object into a JSON string",
    icon: "Braces",
    inputs: [
      {
        key: "pretty",
        label: "Pretty Print",
        type: "boolean",
        default: false,
      },
    ],
    outputs: ["result"],
    color: "#10b981",
  },
  {
    type: "data_split",
    label: "Split Text",
    category: "data",
    description: "Split a string into an array by a delimiter",
    icon: "Scissors",
    inputs: [
      { key: "delimiter", label: "Delimiter", type: "string", default: "," },
    ],
    outputs: ["result"],
    color: "#10b981",
  },
  {
    type: "data_aggregate",
    label: "Aggregate",
    category: "data",
    description: "Aggregate an array (sum, avg, min, max, count, concat)",
    icon: "Calculator",
    inputs: [
      {
        key: "operation",
        label: "Operation",
        type: "select",
        default: "count",
        options: ["sum", "avg", "min", "max", "count", "concat"],
      },
    ],
    outputs: ["result"],
    color: "#10b981",
  },
];
