// ============================================================================
// Agent Evolution & Training System
// Tracks feedback, computes stats, and suggests prompt improvements
// ============================================================================

import { getSpecializedAgent, specializedAgents } from "./definitions.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentFeedback {
  agentId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  category: 'accuracy' | 'helpfulness' | 'creativity' | 'speed' | 'overall';
  comment?: string;
  conversationId?: number;
  timestamp: string;
}

export interface AgentStats {
  agentId: string;
  totalInteractions: number;
  averageRating: number;
  ratingsByCategory: Record<string, number>;
  topStrengths: string[];
  improvementAreas: string[];
  popularQuestions: string[];
  evolutionLevel: number;
}

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const feedbackStore: AgentFeedback[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

/**
 * Compute the average of a number array. Returns 0 for empty arrays.
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute evolution level (1-10) based on total interactions and average rating.
 *
 * Formula:
 *   base = min(floor(interactions / 10), 5)    -- up to 5 levels from volume
 *   bonus = floor((avgRating - 3) * 2.5)       -- up to 5 levels from quality (rating 3 = 0 bonus, 5 = +5)
 *   level = clamp(base + bonus, 1, 10)
 */
function computeEvolutionLevel(totalInteractions: number, averageRating: number): number {
  const volumeComponent = Math.min(Math.floor(totalInteractions / 10), 5);
  const qualityComponent = Math.floor(Math.max(averageRating - 3, 0) * 2.5);
  return Math.max(1, Math.min(10, volumeComponent + qualityComponent));
}

/**
 * Extract top strengths and improvement areas from category ratings.
 */
function analyzeCategories(
  categoryAverages: Record<string, number>
): { strengths: string[]; improvements: string[] } {
  const entries = Object.entries(categoryAverages)
    .filter(([, avg]) => avg > 0)
    .sort((a, b) => b[1] - a[1]);

  const categoryLabels: Record<string, string> = {
    accuracy: 'Accurate and factual responses',
    helpfulness: 'Helpful and actionable advice',
    creativity: 'Creative and innovative thinking',
    speed: 'Fast and efficient responses',
    overall: 'Overall quality',
  };

  const strengths: string[] = [];
  const improvements: string[] = [];

  for (const [cat, avg] of entries) {
    const label = categoryLabels[cat] || cat;
    if (avg >= 4.0) {
      strengths.push(label);
    } else if (avg < 3.0) {
      improvements.push(label);
    }
  }

  // If nothing qualifies, use top / bottom regardless
  if (strengths.length === 0 && entries.length > 0) {
    strengths.push(categoryLabels[entries[0][0]] || entries[0][0]);
  }
  if (improvements.length === 0 && entries.length > 1) {
    const last = entries[entries.length - 1];
    improvements.push(categoryLabels[last[0]] || last[0]);
  }

  return { strengths, improvements };
}

/**
 * Extract popular themes from feedback comments.
 */
function extractPopularQuestions(feedbacks: AgentFeedback[]): string[] {
  const commented = feedbacks.filter((f) => f.comment && f.comment.trim().length > 0);
  // Return the most recent unique comments as "popular questions" proxy
  const seen = new Set<string>();
  const popular: string[] = [];
  for (let i = commented.length - 1; i >= 0 && popular.length < 5; i--) {
    const text = commented[i].comment!.trim();
    if (!seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      popular.push(text);
    }
  }
  return popular;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a new piece of feedback for an agent.
 */
export function recordFeedback(
  feedback: Omit<AgentFeedback, 'timestamp'> & { timestamp?: string }
): AgentFeedback {
  const agent = getSpecializedAgent(feedback.agentId);
  if (!agent) {
    throw new Error(`Specialized agent not found: ${feedback.agentId}`);
  }

  if (feedback.rating < 1 || feedback.rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const validCategories = ['accuracy', 'helpfulness', 'creativity', 'speed', 'overall'];
  if (!validCategories.includes(feedback.category)) {
    throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  const record: AgentFeedback = {
    agentId: feedback.agentId,
    rating: feedback.rating,
    category: feedback.category,
    comment: feedback.comment,
    conversationId: feedback.conversationId,
    timestamp: feedback.timestamp || now(),
  };

  feedbackStore.push(record);
  return record;
}

/**
 * Compute aggregate stats for a specific agent from all recorded feedback.
 */
export function getAgentStats(agentId: string): AgentStats {
  const agent = getSpecializedAgent(agentId);
  if (!agent) {
    throw new Error(`Specialized agent not found: ${agentId}`);
  }

  const agentFeedback = feedbackStore.filter((f) => f.agentId === agentId);

  const totalInteractions = agentFeedback.length;
  const allRatings = agentFeedback.map((f) => f.rating);
  const averageRating = Math.round(average(allRatings) * 100) / 100;

  // Compute per-category averages
  const categories = ['accuracy', 'helpfulness', 'creativity', 'speed', 'overall'];
  const ratingsByCategory: Record<string, number> = {};
  for (const cat of categories) {
    const catRatings = agentFeedback
      .filter((f) => f.category === cat)
      .map((f) => f.rating);
    ratingsByCategory[cat] = Math.round(average(catRatings) * 100) / 100;
  }

  const { strengths, improvements } = analyzeCategories(ratingsByCategory);
  const popularQuestions = extractPopularQuestions(agentFeedback);
  const evolutionLevel = computeEvolutionLevel(totalInteractions, averageRating);

  return {
    agentId,
    totalInteractions,
    averageRating,
    ratingsByCategory,
    topStrengths: strengths,
    improvementAreas: improvements,
    popularQuestions,
    evolutionLevel,
  };
}

/**
 * Get a leaderboard of all agents sorted by average rating (descending).
 * Agents with no feedback appear at the bottom with a rating of 0.
 */
export function getLeaderboard(): AgentStats[] {
  const statsAll = specializedAgents.map((agent) => {
    try {
      return getAgentStats(agent.id);
    } catch {
      return {
        agentId: agent.id,
        totalInteractions: 0,
        averageRating: 0,
        ratingsByCategory: {},
        topStrengths: [],
        improvementAreas: [],
        popularQuestions: [],
        evolutionLevel: 1,
      };
    }
  });

  return statsAll.sort((a, b) => {
    // Primary: average rating descending
    if (b.averageRating !== a.averageRating) {
      return b.averageRating - a.averageRating;
    }
    // Secondary: total interactions descending
    return b.totalInteractions - a.totalInteractions;
  });
}

/**
 * Generate evolution suggestions based on feedback patterns.
 * Returns actionable recommendations for improving the agent's system prompt.
 */
export function getEvolutionSuggestions(agentId: string): {
  agentId: string;
  currentLevel: number;
  suggestions: string[];
  promptAdjustments: string[];
  nextLevelRequirements: string;
} {
  const stats = getAgentStats(agentId);
  const agent = getSpecializedAgent(agentId)!;

  const suggestions: string[] = [];
  const promptAdjustments: string[] = [];

  // Analyze category weaknesses
  const categories = Object.entries(stats.ratingsByCategory).filter(([, avg]) => avg > 0);

  for (const [category, avg] of categories) {
    if (avg < 3.0) {
      switch (category) {
        case 'accuracy':
          suggestions.push(
            'Users report accuracy concerns. Consider adding verification steps and citing sources.'
          );
          promptAdjustments.push(
            'Add instruction: "Always verify claims against known facts. When uncertain, explicitly state your confidence level."'
          );
          break;
        case 'helpfulness':
          suggestions.push(
            'Users find responses less helpful than expected. Focus on actionable, specific advice.'
          );
          promptAdjustments.push(
            'Add instruction: "Always end responses with specific, actionable next steps the user can take immediately."'
          );
          break;
        case 'creativity':
          suggestions.push(
            'Users want more creative and innovative responses. Explore unconventional angles.'
          );
          promptAdjustments.push(
            'Add instruction: "After providing the standard approach, always suggest one creative or unconventional alternative."'
          );
          break;
        case 'speed':
          suggestions.push(
            'Users find responses too long. Aim for conciseness while preserving depth.'
          );
          promptAdjustments.push(
            'Add instruction: "Lead with the key answer in the first paragraph. Use bullet points for supporting details."'
          );
          break;
        case 'overall':
          suggestions.push(
            'Overall satisfaction is below target. Review the most common feedback comments for specific patterns.'
          );
          promptAdjustments.push(
            'Consider restructuring the system prompt to emphasize the most-requested capabilities.'
          );
          break;
      }
    }
  }

  // Analyze high-performing areas to reinforce
  for (const [category, avg] of categories) {
    if (avg >= 4.5) {
      suggestions.push(
        `Excellent performance in ${category} (${avg}/5). This is a key differentiator -- maintain this strength.`
      );
    }
  }

  // General suggestions based on volume
  if (stats.totalInteractions < 10) {
    suggestions.push(
      'Limited feedback data. Encourage more users to provide ratings to get meaningful insights.'
    );
  }

  if (stats.totalInteractions >= 50 && stats.averageRating >= 4.0) {
    suggestions.push(
      `Agent has strong traction with ${stats.totalInteractions} interactions and ${stats.averageRating}/5 rating. ` +
        'Consider featuring this agent more prominently.'
    );
  }

  // Fallback if no specific suggestions
  if (suggestions.length === 0) {
    suggestions.push(
      'No specific improvement areas identified. Continue monitoring feedback for patterns.'
    );
  }

  // Next level requirements
  const currentLevel = stats.evolutionLevel;
  let nextLevelRequirements: string;
  if (currentLevel >= 10) {
    nextLevelRequirements = 'Maximum evolution level reached. Focus on maintaining excellence.';
  } else {
    const interactionsNeeded = Math.max(0, (currentLevel + 1) * 10 - stats.totalInteractions);
    const ratingNeeded = Math.max(3.0, 3.0 + (currentLevel + 1 - 5) * 0.4);
    nextLevelRequirements =
      `To reach level ${currentLevel + 1}: ` +
      (interactionsNeeded > 0 ? `need ~${interactionsNeeded} more interactions` : 'interaction volume is sufficient') +
      ` and maintain average rating >= ${Math.min(ratingNeeded, 5.0).toFixed(1)}`;
  }

  return {
    agentId,
    currentLevel,
    suggestions,
    promptAdjustments,
    nextLevelRequirements,
  };
}

/**
 * Return all feedback, optionally filtered by agentId.
 */
export function getAllFeedback(agentId?: string): AgentFeedback[] {
  if (agentId) {
    return feedbackStore.filter((f) => f.agentId === agentId);
  }
  return [...feedbackStore];
}

/**
 * Get feedback summary statistics across all agents.
 */
export function getFeedbackSummary(): {
  totalFeedback: number;
  uniqueAgents: number;
  globalAverageRating: number;
  categoryBreakdown: Record<string, { count: number; average: number }>;
} {
  const totalFeedback = feedbackStore.length;
  const uniqueAgents = new Set(feedbackStore.map((f) => f.agentId)).size;
  const globalAverageRating =
    Math.round(average(feedbackStore.map((f) => f.rating)) * 100) / 100;

  const categories = ['accuracy', 'helpfulness', 'creativity', 'speed', 'overall'];
  const categoryBreakdown: Record<string, { count: number; average: number }> = {};

  for (const cat of categories) {
    const catFeedback = feedbackStore.filter((f) => f.category === cat);
    categoryBreakdown[cat] = {
      count: catFeedback.length,
      average: Math.round(average(catFeedback.map((f) => f.rating)) * 100) / 100,
    };
  }

  return {
    totalFeedback,
    uniqueAgents,
    globalAverageRating,
    categoryBreakdown,
  };
}
