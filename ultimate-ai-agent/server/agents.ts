import type { Agent } from "../shared/types";

// Default built-in agents
export const defaultAgents: Agent[] = [
  {
    id: "general-assistant",
    name: "General Assistant",
    description: "A helpful general-purpose AI assistant",
    systemPrompt:
      "You are a helpful, friendly AI assistant. Provide clear, accurate, and concise answers. Use markdown formatting when appropriate.",
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
    systemPrompt:
      "You are an expert programming assistant. Help with code reviews, debugging, writing code, and explaining technical concepts. Always provide code examples when relevant. Use proper code blocks with language tags.",
    model: "gpt-4o-mini",
    tools: [],
    temperature: 0.3,
    maxTokens: 4096,
    isActive: true,
  },
  {
    id: "creative-writer",
    name: "Creative Writer",
    description: "Creative writing and content generation",
    systemPrompt:
      "You are a creative writing assistant. Help with stories, articles, marketing copy, and other creative content. Be imaginative and engaging.",
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
    systemPrompt:
      "You are a data analysis expert. Help with data interpretation, statistical analysis, and visualization recommendations. Provide structured responses with tables when helpful.",
    model: "gpt-4o-mini",
    tools: [],
    temperature: 0.3,
    maxTokens: 4096,
    isActive: true,
  },
];

export function getAgentById(
  agents: Agent[],
  id: string
): Agent | undefined {
  return agents.find((a) => a.id === id);
}
