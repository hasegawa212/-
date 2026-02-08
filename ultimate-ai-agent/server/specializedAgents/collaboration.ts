// ============================================================================
// Multi-Agent Collaboration Engine
// Enables multiple specialized agents to work together on complex tasks
// ============================================================================

import { chatCompletion } from "../_core/llm.js";
import { getSpecializedAgent } from "./definitions.js";
import type { SpecializedAgent } from "./definitions.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollabMessage {
  agentId: string;
  agentName: string;
  content: string;
  timestamp: string;
}

export interface CollaborationSession {
  id: string;
  agents: string[];
  mode: 'debate' | 'brainstorm' | 'review' | 'pipeline';
  topic: string;
  messages: CollabMessage[];
  status: 'active' | 'completed';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

const sessions: Map<string, CollaborationSession> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  return `collab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

function resolveAgents(agentIds: string[]): SpecializedAgent[] {
  const resolved: SpecializedAgent[] = [];
  for (const id of agentIds) {
    const agent = getSpecializedAgent(id);
    if (!agent) {
      throw new Error(`Specialized agent not found: ${id}`);
    }
    if (!agent.chainable) {
      throw new Error(
        `Agent "${agent.name}" (${id}) is not chainable and cannot participate in collaboration`
      );
    }
    resolved.push(agent);
  }
  return resolved;
}

/**
 * Build the conversation history as OpenAI messages for a given agent turn.
 */
function buildConversationMessages(
  agent: SpecializedAgent,
  session: CollaborationSession,
  additionalInstruction?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // System prompt for this agent
  const systemContent =
    agent.systemPrompt +
    `\n\nYou are participating in a multi-agent ${session.mode} session on the topic: "${session.topic}". ` +
    `Other agents in this session: ${session.agents
      .filter((id) => id !== agent.id)
      .map((id) => {
        const a = getSpecializedAgent(id);
        return a ? `${a.name} (${a.domain})` : id;
      })
      .join(', ')}. ` +
    `Contribute your unique domain expertise. Be concise but substantive. ` +
    (additionalInstruction ? additionalInstruction : '');

  messages.push({ role: 'system', content: systemContent });

  // Prior conversation turns
  for (const msg of session.messages) {
    if (msg.agentId === agent.id) {
      messages.push({ role: 'assistant', content: msg.content });
    } else {
      messages.push({
        role: 'user',
        content: `[${msg.agentName}]: ${msg.content}`,
      });
    }
  }

  return messages;
}

/**
 * Execute a single agent turn and record the message.
 */
async function executeAgentTurn(
  agent: SpecializedAgent,
  session: CollaborationSession,
  additionalInstruction?: string
): Promise<CollabMessage> {
  const messages = buildConversationMessages(agent, session, additionalInstruction);

  const response = await chatCompletion(
    messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    {
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    }
  );

  const collabMessage: CollabMessage = {
    agentId: agent.id,
    agentName: agent.name,
    content: response.content,
    timestamp: now(),
  };

  session.messages.push(collabMessage);
  return collabMessage;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new collaboration session.
 */
export function createCollaboration(
  agentIds: string[],
  mode: CollaborationSession['mode'],
  topic: string
): CollaborationSession {
  if (agentIds.length < 2) {
    throw new Error('Collaboration requires at least 2 agents');
  }

  // Validate all agents exist and are chainable
  resolveAgents(agentIds);

  const session: CollaborationSession = {
    id: generateSessionId(),
    agents: agentIds,
    mode,
    topic,
    messages: [],
    status: 'active',
    createdAt: now(),
  };

  sessions.set(session.id, session);
  return session;
}

/**
 * Run one round of collaboration where each agent responds in sequence.
 * If `userMessage` is provided, it is injected as context before the round.
 */
export async function runCollaborationRound(
  session: CollaborationSession,
  userMessage?: string
): Promise<CollabMessage[]> {
  if (session.status === 'completed') {
    throw new Error('Cannot run a round on a completed session');
  }

  // Inject user message if provided
  if (userMessage) {
    session.messages.push({
      agentId: 'user',
      agentName: 'User',
      content: userMessage,
      timestamp: now(),
    });
  }

  const agents = resolveAgents(session.agents);
  const roundMessages: CollabMessage[] = [];

  for (const agent of agents) {
    const msg = await executeAgentTurn(agent, session);
    roundMessages.push(msg);
  }

  return roundMessages;
}

/**
 * Run a structured debate over multiple rounds.
 * Agents take turns arguing different perspectives on the topic.
 */
export async function runDebate(
  session: CollaborationSession,
  topic: string,
  rounds: number = 3
): Promise<CollabMessage[]> {
  if (session.mode !== 'debate') {
    throw new Error('Session mode must be "debate" to run a debate');
  }

  const agents = resolveAgents(session.agents);
  const allMessages: CollabMessage[] = [];

  // Opening: inject the debate topic
  session.messages.push({
    agentId: 'system',
    agentName: 'Moderator',
    content: `DEBATE TOPIC: ${topic}\n\nEach agent will present their perspective from their domain expertise. Please argue your position clearly and respond to other agents' points.`,
    timestamp: now(),
  });

  for (let round = 1; round <= rounds; round++) {
    const roundInstruction =
      round === 1
        ? 'Present your opening argument on this topic from your domain perspective.'
        : round === rounds
          ? 'Present your closing argument. Summarize your key points and address the strongest counterarguments raised.'
          : `Round ${round}: Respond to the previous arguments. Challenge points you disagree with and reinforce your position with evidence.`;

    for (const agent of agents) {
      const msg = await executeAgentTurn(agent, session, roundInstruction);
      allMessages.push(msg);
    }
  }

  session.status = 'completed';
  return allMessages;
}

/**
 * Run a brainstorming session over multiple rounds.
 * Agents build on each other's ideas constructively.
 */
export async function runBrainstorm(
  session: CollaborationSession,
  topic: string,
  rounds: number = 3
): Promise<CollabMessage[]> {
  if (session.mode !== 'brainstorm') {
    throw new Error('Session mode must be "brainstorm" to run a brainstorm');
  }

  const agents = resolveAgents(session.agents);
  const allMessages: CollabMessage[] = [];

  // Opening: inject the brainstorm topic
  session.messages.push({
    agentId: 'system',
    agentName: 'Facilitator',
    content: `BRAINSTORM TOPIC: ${topic}\n\nRules: Build on each other's ideas ("Yes, and..."). No criticism in the first round. Be creative and think outside your usual domain. Aim for quantity of ideas.`,
    timestamp: now(),
  });

  for (let round = 1; round <= rounds; round++) {
    const roundInstruction =
      round === 1
        ? 'Generate 3-5 creative ideas related to this topic from your unique perspective. Be bold and innovative.'
        : round === rounds
          ? 'Review all ideas shared so far. Select the top 3 most promising ones and explain how they could be combined or refined into actionable proposals.'
          : `Round ${round}: Build on the most interesting ideas shared so far. Add new dimensions from your expertise. Combine ideas in unexpected ways.`;

    for (const agent of agents) {
      const msg = await executeAgentTurn(agent, session, roundInstruction);
      allMessages.push(msg);
    }
  }

  session.status = 'completed';
  return allMessages;
}

/**
 * Run a review session where each agent reviews content from their perspective.
 * Single round -- each agent provides their domain-specific review.
 */
export async function runReview(
  session: CollaborationSession,
  content: string
): Promise<CollabMessage[]> {
  if (session.mode !== 'review') {
    throw new Error('Session mode must be "review" to run a review');
  }

  const agents = resolveAgents(session.agents);
  const allMessages: CollabMessage[] = [];

  // Inject the content to review
  session.messages.push({
    agentId: 'system',
    agentName: 'Review Coordinator',
    content: `CONTENT FOR REVIEW:\n\n${content}\n\nPlease review this content from your domain expertise. Provide specific, actionable feedback organized as: Strengths, Issues/Risks, and Recommendations.`,
    timestamp: now(),
  });

  const reviewInstruction =
    'Review the content above from your domain expertise. Structure your review as: ' +
    '1) Strengths (what is done well), ' +
    '2) Issues & Risks (problems or gaps from your perspective), ' +
    '3) Specific Recommendations (actionable improvements). ' +
    'Be constructive and specific. Reference exact parts of the content where relevant.';

  for (const agent of agents) {
    const msg = await executeAgentTurn(agent, session, reviewInstruction);
    allMessages.push(msg);
  }

  // Synthesis round: last agent summarizes if there are 3+ agents
  if (agents.length >= 3) {
    const synthesisInstruction =
      'Synthesize all the reviews above into a unified summary: ' +
      'list the top 5 most critical findings across all reviewers, ' +
      'note areas of agreement and disagreement, ' +
      'and provide a prioritized action plan.';

    const synthesizer = agents[agents.length - 1];
    const summaryMsg = await executeAgentTurn(synthesizer, session, synthesisInstruction);
    allMessages.push(summaryMsg);
  }

  session.status = 'completed';
  return allMessages;
}

/**
 * Run a pipeline where the output of one agent feeds into the next.
 * Sequential processing chain.
 */
export async function runPipeline(
  session: CollaborationSession,
  input: string
): Promise<CollabMessage[]> {
  if (session.mode !== 'pipeline') {
    throw new Error('Session mode must be "pipeline" to run a pipeline');
  }

  const agents = resolveAgents(session.agents);
  const allMessages: CollabMessage[] = [];

  // Inject the initial input
  session.messages.push({
    agentId: 'user',
    agentName: 'Pipeline Input',
    content: input,
    timestamp: now(),
  });

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const isFirst = i === 0;
    const isLast = i === agents.length - 1;

    let pipelineInstruction: string;
    if (isFirst) {
      pipelineInstruction =
        `You are step ${i + 1} of ${agents.length} in a processing pipeline. ` +
        'Process the input above using your domain expertise. ' +
        'Your output will be passed to the next agent in the chain. ' +
        'Be thorough and structured in your response.';
    } else if (isLast) {
      pipelineInstruction =
        `You are the final step (${i + 1} of ${agents.length}) in a processing pipeline. ` +
        'Take the previous agent\'s output and produce the final, polished result. ' +
        'Integrate insights from all previous stages into a comprehensive deliverable.';
    } else {
      pipelineInstruction =
        `You are step ${i + 1} of ${agents.length} in a processing pipeline. ` +
        'Take the previous agent\'s output and enhance it with your domain expertise. ' +
        'Your output will be passed to the next agent. Maintain and build on the existing structure.';
    }

    const msg = await executeAgentTurn(agent, session, pipelineInstruction);
    allMessages.push(msg);
  }

  session.status = 'completed';
  return allMessages;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Retrieve a session by ID.
 */
export function getSession(sessionId: string): CollaborationSession | undefined {
  return sessions.get(sessionId);
}

/**
 * List all sessions, optionally filtered by status.
 */
export function listSessions(
  status?: CollaborationSession['status']
): CollaborationSession[] {
  const all = Array.from(sessions.values());
  if (status) {
    return all.filter((s) => s.status === status);
  }
  return all;
}

/**
 * Mark a session as completed.
 */
export function completeSession(sessionId: string): CollaborationSession {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  session.status = 'completed';
  return session;
}

/**
 * Delete a session.
 */
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}
