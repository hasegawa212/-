// Client-side node type definitions matching the server-side workflow engine

export type NodeCategory = 'trigger' | 'ai' | 'logic' | 'data' | 'integration';

export interface ConfigFieldDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'code' | 'json';
  default?: string | number | boolean;
  options?: string[];
}

export interface NodeTypeDef {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string; // lucide-react icon name
  color: string; // tailwind color name
  configFields: ConfigFieldDef[];
}

// Category color mapping
export const categoryColors: Record<NodeCategory, string> = {
  trigger: 'emerald',
  ai: 'violet',
  logic: 'amber',
  data: 'blue',
  integration: 'rose',
};

export const categoryLabels: Record<NodeCategory, string> = {
  trigger: 'Triggers',
  ai: 'AI',
  logic: 'Logic',
  data: 'Data',
  integration: 'Integrations',
};

export const allNodeTypes: NodeTypeDef[] = [
  // ===== Triggers (5) =====
  {
    type: 'trigger_manual',
    label: 'Manual Trigger',
    category: 'trigger',
    description: 'Start workflow manually with optional input data',
    icon: 'Play',
    color: 'emerald',
    configFields: [
      { key: 'inputSchema', label: 'Input Schema', type: 'json', default: '{}' },
    ],
  },
  {
    type: 'trigger_webhook',
    label: 'Webhook Trigger',
    category: 'trigger',
    description: 'Start workflow from an incoming HTTP webhook',
    icon: 'Webhook',
    color: 'emerald',
    configFields: [
      { key: 'path', label: 'Webhook Path', type: 'string', default: '/webhook' },
      { key: 'method', label: 'HTTP Method', type: 'select', default: 'POST', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { key: 'secret', label: 'Secret Token', type: 'string', default: '' },
    ],
  },
  {
    type: 'trigger_schedule',
    label: 'Schedule Trigger',
    category: 'trigger',
    description: 'Run workflow on a cron schedule',
    icon: 'Clock',
    color: 'emerald',
    configFields: [
      { key: 'cron', label: 'Cron Expression', type: 'string', default: '0 * * * *' },
      { key: 'timezone', label: 'Timezone', type: 'string', default: 'UTC' },
    ],
  },
  {
    type: 'trigger_event',
    label: 'Event Trigger',
    category: 'trigger',
    description: 'Start workflow when a system event occurs',
    icon: 'Zap',
    color: 'emerald',
    configFields: [
      { key: 'eventName', label: 'Event Name', type: 'string', default: '' },
      { key: 'filter', label: 'Event Filter', type: 'json', default: '{}' },
    ],
  },
  {
    type: 'trigger_chat',
    label: 'Chat Trigger',
    category: 'trigger',
    description: 'Start workflow from a chat message',
    icon: 'MessageSquare',
    color: 'emerald',
    configFields: [
      { key: 'pattern', label: 'Message Pattern', type: 'string', default: '' },
      { key: 'agentId', label: 'Agent ID', type: 'string', default: '' },
    ],
  },

  // ===== AI (7) =====
  {
    type: 'ai_llm',
    label: 'LLM Completion',
    category: 'ai',
    description: 'Generate text using a large language model',
    icon: 'Brain',
    color: 'violet',
    configFields: [
      { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o-mini', options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
      { key: 'prompt', label: 'Prompt Template', type: 'code', default: '{{input}}' },
      { key: 'systemPrompt', label: 'System Prompt', type: 'code', default: 'You are a helpful assistant.' },
      { key: 'temperature', label: 'Temperature', type: 'number', default: 0.7 },
      { key: 'maxTokens', label: 'Max Tokens', type: 'number', default: 2048 },
    ],
  },
  {
    type: 'ai_chat',
    label: 'AI Chat',
    category: 'ai',
    description: 'Multi-turn conversational AI interaction',
    icon: 'MessageSquare',
    color: 'violet',
    configFields: [
      { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o-mini', options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
      { key: 'systemPrompt', label: 'System Prompt', type: 'code', default: '' },
      { key: 'memoryEnabled', label: 'Enable Memory', type: 'boolean', default: true },
      { key: 'maxHistory', label: 'Max History Messages', type: 'number', default: 20 },
    ],
  },
  {
    type: 'ai_classify',
    label: 'AI Classifier',
    category: 'ai',
    description: 'Classify input text into predefined categories',
    icon: 'Sparkles',
    color: 'violet',
    configFields: [
      { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o-mini', options: ['gpt-4o', 'gpt-4o-mini', 'claude-3-haiku'] },
      { key: 'categories', label: 'Categories (comma-separated)', type: 'string', default: 'positive,negative,neutral' },
      { key: 'prompt', label: 'Classification Prompt', type: 'code', default: 'Classify the following text into one of these categories: {{categories}}\n\nText: {{input}}' },
    ],
  },
  {
    type: 'ai_extract',
    label: 'AI Extractor',
    category: 'ai',
    description: 'Extract structured data from unstructured text',
    icon: 'FileText',
    color: 'violet',
    configFields: [
      { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o-mini', options: ['gpt-4o', 'gpt-4o-mini', 'claude-3-sonnet'] },
      { key: 'schema', label: 'Output Schema', type: 'json', default: '{"name": "string", "email": "string"}' },
      { key: 'prompt', label: 'Extraction Prompt', type: 'code', default: 'Extract the following fields from the text: {{schema}}\n\nText: {{input}}' },
    ],
  },
  {
    type: 'ai_summarize',
    label: 'AI Summarizer',
    category: 'ai',
    description: 'Summarize long text into concise form',
    icon: 'Sparkles',
    color: 'violet',
    configFields: [
      { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o-mini', options: ['gpt-4o', 'gpt-4o-mini', 'claude-3-haiku'] },
      { key: 'maxLength', label: 'Max Summary Length', type: 'number', default: 200 },
      { key: 'style', label: 'Style', type: 'select', default: 'concise', options: ['concise', 'detailed', 'bullet-points', 'executive'] },
    ],
  },
  {
    type: 'ai_translate',
    label: 'AI Translator',
    category: 'ai',
    description: 'Translate text between languages',
    icon: 'Languages',
    color: 'violet',
    configFields: [
      { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o-mini', options: ['gpt-4o', 'gpt-4o-mini', 'claude-3-haiku'] },
      { key: 'sourceLang', label: 'Source Language', type: 'string', default: 'auto' },
      { key: 'targetLang', label: 'Target Language', type: 'string', default: 'en' },
    ],
  },
  {
    type: 'ai_agent',
    label: 'AI Agent',
    category: 'ai',
    description: 'Run an autonomous AI agent with tool access',
    icon: 'Brain',
    color: 'violet',
    configFields: [
      { key: 'agentId', label: 'Agent ID', type: 'string', default: '' },
      { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o', options: ['gpt-4o', 'gpt-4o-mini', 'claude-3-opus', 'claude-3-sonnet'] },
      { key: 'tools', label: 'Enabled Tools', type: 'json', default: '["web_search", "code_execution"]' },
      { key: 'maxSteps', label: 'Max Steps', type: 'number', default: 10 },
      { key: 'systemPrompt', label: 'System Prompt', type: 'code', default: '' },
    ],
  },

  // ===== Logic (8) =====
  {
    type: 'logic_if',
    label: 'If / Condition',
    category: 'logic',
    description: 'Branch workflow based on a condition',
    icon: 'GitBranch',
    color: 'amber',
    configFields: [
      { key: 'condition', label: 'Condition Expression', type: 'code', default: '{{input.value}} > 0' },
    ],
  },
  {
    type: 'logic_switch',
    label: 'Switch',
    category: 'logic',
    description: 'Route to different branches based on a value',
    icon: 'GitBranch',
    color: 'amber',
    configFields: [
      { key: 'expression', label: 'Switch Expression', type: 'code', default: '{{input.type}}' },
      { key: 'cases', label: 'Cases (JSON)', type: 'json', default: '{"case1": "value1", "case2": "value2"}' },
    ],
  },
  {
    type: 'logic_loop',
    label: 'Loop / For Each',
    category: 'logic',
    description: 'Iterate over a list of items',
    icon: 'Repeat',
    color: 'amber',
    configFields: [
      { key: 'items', label: 'Items Expression', type: 'code', default: '{{input.items}}' },
      { key: 'maxIterations', label: 'Max Iterations', type: 'number', default: 100 },
    ],
  },
  {
    type: 'logic_delay',
    label: 'Delay / Wait',
    category: 'logic',
    description: 'Pause execution for a specified duration',
    icon: 'Timer',
    color: 'amber',
    configFields: [
      { key: 'duration', label: 'Duration (ms)', type: 'number', default: 1000 },
    ],
  },
  {
    type: 'logic_merge',
    label: 'Merge',
    category: 'logic',
    description: 'Merge multiple branch outputs into one',
    icon: 'Merge',
    color: 'amber',
    configFields: [
      { key: 'mode', label: 'Merge Mode', type: 'select', default: 'waitAll', options: ['waitAll', 'waitAny', 'append', 'combine'] },
    ],
  },
  {
    type: 'logic_filter',
    label: 'Filter',
    category: 'logic',
    description: 'Filter items in an array based on a condition',
    icon: 'Filter',
    color: 'amber',
    configFields: [
      { key: 'condition', label: 'Filter Condition', type: 'code', default: '{{item.active}} === true' },
    ],
  },
  {
    type: 'logic_error_handler',
    label: 'Error Handler',
    category: 'logic',
    description: 'Catch and handle errors from previous nodes',
    icon: 'ShieldAlert',
    color: 'amber',
    configFields: [
      { key: 'retryCount', label: 'Retry Count', type: 'number', default: 3 },
      { key: 'retryDelay', label: 'Retry Delay (ms)', type: 'number', default: 1000 },
      { key: 'fallbackValue', label: 'Fallback Value', type: 'json', default: 'null' },
    ],
  },
  {
    type: 'logic_code',
    label: 'Code / Script',
    category: 'logic',
    description: 'Execute custom JavaScript code',
    icon: 'Code',
    color: 'amber',
    configFields: [
      { key: 'code', label: 'JavaScript Code', type: 'code', default: '// Access input with: input\n// Return output:\nreturn input;' },
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 },
    ],
  },

  // ===== Data (8) =====
  {
    type: 'data_transform',
    label: 'Transform',
    category: 'data',
    description: 'Transform data using a mapping expression',
    icon: 'Sparkles',
    color: 'blue',
    configFields: [
      { key: 'expression', label: 'Transform Expression', type: 'code', default: '{{ { result: input.data } }}' },
    ],
  },
  {
    type: 'data_template',
    label: 'Template',
    category: 'data',
    description: 'Generate text from a template with variables',
    icon: 'FileText',
    color: 'blue',
    configFields: [
      { key: 'template', label: 'Template', type: 'code', default: 'Hello, {{name}}! Your order #{{orderId}} is ready.' },
    ],
  },
  {
    type: 'data_split',
    label: 'Split',
    category: 'data',
    description: 'Split a single item into multiple items',
    icon: 'Split',
    color: 'blue',
    configFields: [
      { key: 'field', label: 'Field to Split', type: 'string', default: 'items' },
      { key: 'delimiter', label: 'Delimiter', type: 'string', default: ',' },
    ],
  },
  {
    type: 'data_aggregate',
    label: 'Aggregate',
    category: 'data',
    description: 'Aggregate multiple items into a single output',
    icon: 'Calculator',
    color: 'blue',
    configFields: [
      { key: 'operation', label: 'Operation', type: 'select', default: 'collect', options: ['collect', 'sum', 'average', 'count', 'min', 'max', 'concat'] },
      { key: 'field', label: 'Field', type: 'string', default: '' },
    ],
  },
  {
    type: 'data_set',
    label: 'Set Values',
    category: 'data',
    description: 'Set or override values in the data',
    icon: 'Hash',
    color: 'blue',
    configFields: [
      { key: 'values', label: 'Values (JSON)', type: 'json', default: '{"key": "value"}' },
      { key: 'mode', label: 'Mode', type: 'select', default: 'merge', options: ['merge', 'replace'] },
    ],
  },
  {
    type: 'data_validate',
    label: 'Validate',
    category: 'data',
    description: 'Validate data against a JSON schema',
    icon: 'ShieldAlert',
    color: 'blue',
    configFields: [
      { key: 'schema', label: 'JSON Schema', type: 'json', default: '{"type": "object", "required": ["name"]}' },
      { key: 'onError', label: 'On Error', type: 'select', default: 'reject', options: ['reject', 'default', 'passthrough'] },
    ],
  },
  {
    type: 'data_rag_query',
    label: 'RAG Query',
    category: 'data',
    description: 'Query the RAG knowledge base for relevant documents',
    icon: 'Database',
    color: 'blue',
    configFields: [
      { key: 'query', label: 'Query Expression', type: 'code', default: '{{input.question}}' },
      { key: 'topK', label: 'Top K Results', type: 'number', default: 5 },
      { key: 'threshold', label: 'Similarity Threshold', type: 'number', default: 0.7 },
    ],
  },
  {
    type: 'data_json_parse',
    label: 'JSON Parse',
    category: 'data',
    description: 'Parse a JSON string into an object',
    icon: 'Code',
    color: 'blue',
    configFields: [
      { key: 'field', label: 'Field to Parse', type: 'string', default: 'body' },
      { key: 'strict', label: 'Strict Mode', type: 'boolean', default: true },
    ],
  },

  // ===== Integrations (6) =====
  {
    type: 'integration_http',
    label: 'HTTP Request',
    category: 'integration',
    description: 'Make an HTTP request to an external API',
    icon: 'Globe',
    color: 'rose',
    configFields: [
      { key: 'url', label: 'URL', type: 'string', default: 'https://api.example.com' },
      { key: 'method', label: 'Method', type: 'select', default: 'GET', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'headers', label: 'Headers', type: 'json', default: '{"Content-Type": "application/json"}' },
      { key: 'body', label: 'Request Body', type: 'json', default: '{}' },
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 30000 },
    ],
  },
  {
    type: 'integration_email',
    label: 'Send Email',
    category: 'integration',
    description: 'Send an email via SMTP or API',
    icon: 'Mail',
    color: 'rose',
    configFields: [
      { key: 'to', label: 'To', type: 'string', default: '' },
      { key: 'subject', label: 'Subject', type: 'string', default: '' },
      { key: 'body', label: 'Body', type: 'code', default: '' },
      { key: 'isHtml', label: 'HTML Body', type: 'boolean', default: false },
    ],
  },
  {
    type: 'integration_database',
    label: 'Database Query',
    category: 'integration',
    description: 'Execute a query against a database',
    icon: 'Database',
    color: 'rose',
    configFields: [
      { key: 'connectionString', label: 'Connection String', type: 'string', default: '' },
      { key: 'query', label: 'SQL Query', type: 'code', default: 'SELECT * FROM table WHERE id = {{input.id}}' },
      { key: 'dbType', label: 'Database Type', type: 'select', default: 'sqlite', options: ['sqlite', 'postgres', 'mysql'] },
    ],
  },
  {
    type: 'integration_file_read',
    label: 'Read File',
    category: 'integration',
    description: 'Read a file from disk or cloud storage',
    icon: 'FileInput',
    color: 'rose',
    configFields: [
      { key: 'path', label: 'File Path', type: 'string', default: '' },
      { key: 'encoding', label: 'Encoding', type: 'select', default: 'utf-8', options: ['utf-8', 'ascii', 'base64', 'binary'] },
    ],
  },
  {
    type: 'integration_file_write',
    label: 'Write File',
    category: 'integration',
    description: 'Write data to a file on disk or cloud storage',
    icon: 'FileOutput',
    color: 'rose',
    configFields: [
      { key: 'path', label: 'File Path', type: 'string', default: '' },
      { key: 'content', label: 'Content Expression', type: 'code', default: '{{input.data}}' },
      { key: 'encoding', label: 'Encoding', type: 'select', default: 'utf-8', options: ['utf-8', 'ascii', 'base64'] },
      { key: 'append', label: 'Append Mode', type: 'boolean', default: false },
    ],
  },
  {
    type: 'integration_rss',
    label: 'RSS Feed',
    category: 'integration',
    description: 'Fetch and parse an RSS or Atom feed',
    icon: 'Rss',
    color: 'rose',
    configFields: [
      { key: 'url', label: 'Feed URL', type: 'string', default: '' },
      { key: 'maxItems', label: 'Max Items', type: 'number', default: 10 },
    ],
  },
];

// Helper to look up a node type definition by type string
export function getNodeTypeDef(type: string): NodeTypeDef | undefined {
  return allNodeTypes.find((nt) => nt.type === type);
}

// Helper to get all node types for a category
export function getNodeTypesByCategory(category: NodeCategory): NodeTypeDef[] {
  return allNodeTypes.filter((nt) => nt.category === category);
}

// Tailwind color class helpers
export function getCategoryBgClass(category: NodeCategory): string {
  const map: Record<NodeCategory, string> = {
    trigger: 'bg-emerald-500',
    ai: 'bg-violet-500',
    logic: 'bg-amber-500',
    data: 'bg-blue-500',
    integration: 'bg-rose-500',
  };
  return map[category];
}

export function getCategoryBgLightClass(category: NodeCategory): string {
  const map: Record<NodeCategory, string> = {
    trigger: 'bg-emerald-50 dark:bg-emerald-950',
    ai: 'bg-violet-50 dark:bg-violet-950',
    logic: 'bg-amber-50 dark:bg-amber-950',
    data: 'bg-blue-50 dark:bg-blue-950',
    integration: 'bg-rose-50 dark:bg-rose-950',
  };
  return map[category];
}

export function getCategoryTextClass(category: NodeCategory): string {
  const map: Record<NodeCategory, string> = {
    trigger: 'text-emerald-600 dark:text-emerald-400',
    ai: 'text-violet-600 dark:text-violet-400',
    logic: 'text-amber-600 dark:text-amber-400',
    data: 'text-blue-600 dark:text-blue-400',
    integration: 'text-rose-600 dark:text-rose-400',
  };
  return map[category];
}

export function getCategoryBorderClass(category: NodeCategory): string {
  const map: Record<NodeCategory, string> = {
    trigger: 'border-emerald-500',
    ai: 'border-violet-500',
    logic: 'border-amber-500',
    data: 'border-blue-500',
    integration: 'border-rose-500',
  };
  return map[category];
}
