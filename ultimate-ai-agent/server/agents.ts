import type { Agent } from "../shared/types";

export const defaultAgents: Agent[] = [
  {
    id: "general-assistant",
    name: "General Assistant",
    description: "A helpful general-purpose AI assistant",
    systemPrompt: "You are a helpful, friendly AI assistant. Provide clear, accurate, and concise answers. Use markdown formatting when appropriate.",
    model: "gpt-4o-mini",
    tools: [],
    temperature: 0.7,
    maxTokens: 4096,
    isActive: true,
  },
  {
    id: "code-assistant",
    name: "Code Assistant",
    description: "Specialized in programming and software development",
    systemPrompt: "You are an expert programming assistant. Help with code reviews, debugging, writing code, and explaining technical concepts. Always provide code examples when relevant.",
    model: "gpt-4o-mini",
    tools: ["execute_code"],
    temperature: 0.3,
    maxTokens: 4096,
    isActive: true,
  },
  {
    id: "creative-writer",
    name: "Creative Writer",
    description: "Creative writing and content generation",
    systemPrompt: "You are a creative writing assistant. Help with stories, articles, marketing copy, and other creative content.",
    model: "gpt-4o-mini",
    tools: [],
    temperature: 1.0,
    maxTokens: 4096,
    isActive: true,
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    description: "Data analysis, statistics, and visualization advice",
    systemPrompt: "You are a data analysis expert. Help with data interpretation, statistical analysis, and visualization recommendations.",
    model: "gpt-4o-mini",
    tools: ["calculator"],
    temperature: 0.3,
    maxTokens: 4096,
    isActive: true,
  },
  {
    id: "research-agent",
    name: "Research Agent",
    description: "Web research and information gathering",
    systemPrompt: "You are a research assistant. Help users find information, summarize findings, and compile research. Use web search when available.",
    model: "gpt-4o-mini",
    tools: ["web_search"],
    temperature: 0.5,
    maxTokens: 4096,
    isActive: true,
  },
];

export const promptTemplates = [
  { id: "summarize", name: "Summarize Text", template: "Please summarize the following text concisely:\n\n{input}", category: "analysis" },
  { id: "translate-en-ja", name: "Translate EN->JA", template: "Translate the following English text to Japanese:\n\n{input}", category: "translation" },
  { id: "translate-ja-en", name: "Translate JA->EN", template: "Translate the following Japanese text to English:\n\n{input}", category: "translation" },
  { id: "code-review", name: "Code Review", template: "Please review the following code and suggest improvements:\n\n```\n{input}\n```", category: "development" },
  { id: "explain-code", name: "Explain Code", template: "Please explain what the following code does step by step:\n\n```\n{input}\n```", category: "development" },
  { id: "write-tests", name: "Write Tests", template: "Write unit tests for the following code:\n\n```\n{input}\n```", category: "development" },
  { id: "fix-grammar", name: "Fix Grammar", template: "Fix the grammar and improve the writing of the following text:\n\n{input}", category: "writing" },
  { id: "brainstorm", name: "Brainstorm Ideas", template: "Brainstorm 10 creative ideas about: {input}", category: "creative" },
];

export function getAgentById(agents: Agent[], id: string): Agent | undefined {
  return agents.find((a) => a.id === id);
}
