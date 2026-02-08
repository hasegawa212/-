// ============================================================================
// Agent Benchmarking System
// Evaluates agent quality with standardized tests and scoring
// ============================================================================

import { chatCompletion } from "../_core/llm.js";
import { getSpecializedAgent } from "./definitions.js";
import type { SpecializedAgent } from "./definitions.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkTest {
  id: string;
  name: string;
  domain: string;
  prompt: string;
  expectedTopics: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface BenchmarkResult {
  agentId: string;
  testId: string;
  score: number; // 0-100
  responseTime: number; // milliseconds
  response: string;
  topicsCovered: string[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const benchmarkResults: BenchmarkResult[] = [];

// ---------------------------------------------------------------------------
// 16 Benchmark Tests
// ---------------------------------------------------------------------------

export const benchmarkTests: BenchmarkTest[] = [
  // --- Engineering ---
  {
    id: 'eng-system-design',
    name: 'System Design: URL Shortener',
    domain: 'engineering',
    prompt:
      'Design a URL shortener service that handles 100 million URLs and 10,000 requests per second. Include the architecture, database choice, hashing strategy, and caching layer.',
    expectedTopics: [
      'hash', 'database', 'cache', 'redis', 'load balancer',
      'scalability', 'API', 'encoding', 'base62', 'collision',
      'read-heavy', 'replication',
    ],
    difficulty: 'hard',
  },
  {
    id: 'eng-docker',
    name: 'DevOps: Multi-Stage Docker Build',
    domain: 'engineering',
    prompt:
      'Create a production-ready multi-stage Dockerfile for a Node.js TypeScript application with health checks, non-root user, and minimized image size.',
    expectedTopics: [
      'multi-stage', 'FROM', 'alpine', 'node_modules', 'build',
      'COPY', 'USER', 'HEALTHCHECK', 'distroless', 'layer',
      'npm ci', '.dockerignore',
    ],
    difficulty: 'medium',
  },
  {
    id: 'eng-security-owasp',
    name: 'Security: OWASP API Top 10',
    domain: 'engineering',
    prompt:
      'List and explain the OWASP API Security Top 10 risks. For each risk, provide a concrete example and a specific mitigation strategy.',
    expectedTopics: [
      'broken object level authorization', 'authentication', 'injection',
      'rate limiting', 'mass assignment', 'security misconfiguration',
      'BOLA', 'JWT', 'token', 'input validation', 'logging',
    ],
    difficulty: 'medium',
  },

  // --- Business ---
  {
    id: 'biz-pitch-deck',
    name: 'Startup: Pitch Deck Structure',
    domain: 'business',
    prompt:
      'Create a detailed pitch deck outline for an AI-powered legal document review startup seeking Series A funding at $5M ARR. Include each slide with key content points.',
    expectedTopics: [
      'problem', 'solution', 'market size', 'TAM', 'traction',
      'team', 'financials', 'ask', 'competition', 'business model',
      'ARR', 'growth', 'moat',
    ],
    difficulty: 'medium',
  },
  {
    id: 'biz-seo-strategy',
    name: 'Marketing: SEO Content Strategy',
    domain: 'business',
    prompt:
      'Develop a comprehensive SEO content strategy for a B2B SaaS project management tool. Include keyword research approach, content pillars, and a 3-month content calendar.',
    expectedTopics: [
      'keyword research', 'content pillar', 'long-tail', 'search intent',
      'SERP', 'backlink', 'on-page', 'meta description', 'internal linking',
      'calendar', 'blog', 'competitor analysis',
    ],
    difficulty: 'medium',
  },
  {
    id: 'biz-financial-model',
    name: 'Finance: SaaS Financial Model',
    domain: 'business',
    prompt:
      'Build a 3-year financial projection framework for a SaaS startup with $1M ARR, 15% monthly churn, $500 CAC, and $5K average ACV. Include key metrics and assumptions.',
    expectedTopics: [
      'ARR', 'MRR', 'churn', 'LTV', 'CAC', 'payback period',
      'gross margin', 'burn rate', 'runway', 'revenue growth',
      'cohort', 'net revenue retention',
    ],
    difficulty: 'hard',
  },

  // --- Creative ---
  {
    id: 'cre-landing-page',
    name: 'Copywriting: SaaS Landing Page',
    domain: 'creative',
    prompt:
      'Write complete landing page copy for an AI-powered email assistant that saves professionals 2 hours per day. Include headline, subheadline, features section, social proof section, and CTA.',
    expectedTopics: [
      'headline', 'subheadline', 'benefit', 'feature', 'CTA',
      'call to action', 'social proof', 'testimonial', 'free trial',
      'save time', 'AI', 'productivity',
    ],
    difficulty: 'easy',
  },
  {
    id: 'cre-ux-onboarding',
    name: 'UX Design: User Onboarding Flow',
    domain: 'creative',
    prompt:
      'Design a user onboarding flow for a project management SaaS. Include step-by-step screens, progressive disclosure strategy, and accessibility considerations.',
    expectedTopics: [
      'onboarding', 'progressive disclosure', 'tooltip', 'wizard',
      'welcome', 'accessibility', 'WCAG', 'step', 'screen',
      'skip', 'checklist', 'empty state',
    ],
    difficulty: 'medium',
  },

  // --- Science ---
  {
    id: 'sci-experiment-design',
    name: 'Research: Experiment Design',
    domain: 'science',
    prompt:
      'Design a randomized controlled trial to test whether a new spaced repetition algorithm improves vocabulary retention compared to traditional flashcards. Include sample size, variables, controls, and statistical analysis plan.',
    expectedTopics: [
      'randomized', 'control group', 'sample size', 'hypothesis',
      'independent variable', 'dependent variable', 'p-value',
      'statistical significance', 'power analysis', 'blinding',
      'pre-test', 'post-test',
    ],
    difficulty: 'hard',
  },
  {
    id: 'sci-ml-pipeline',
    name: 'Data Science: ML Pipeline',
    domain: 'science',
    prompt:
      'Design a complete machine learning pipeline for predicting customer churn. Include data preprocessing, feature engineering, model selection, evaluation metrics, and deployment strategy.',
    expectedTopics: [
      'feature engineering', 'train/test split', 'cross-validation',
      'precision', 'recall', 'AUC', 'ROC', 'class imbalance',
      'model selection', 'hyperparameter', 'deployment', 'monitoring',
    ],
    difficulty: 'medium',
  },

  // --- Health ---
  {
    id: 'hlt-fitness-program',
    name: 'Health: 12-Week Fitness Program',
    domain: 'health',
    prompt:
      'Create a 12-week beginner strength training program for someone with no gym experience. Include exercises, sets, reps, progression scheme, and nutrition guidelines. Add appropriate disclaimers.',
    expectedTopics: [
      'squat', 'deadlift', 'press', 'progressive overload', 'sets',
      'reps', 'rest', 'warm-up', 'nutrition', 'protein',
      'recovery', 'disclaimer',
    ],
    difficulty: 'easy',
  },

  // --- Legal ---
  {
    id: 'leg-contract-review',
    name: 'Legal: SaaS Contract Review',
    domain: 'legal',
    prompt:
      'Provide a checklist for reviewing a SaaS vendor contract. Highlight the most critical clauses, common red flags, and negotiation leverage points. Include appropriate disclaimers.',
    expectedTopics: [
      'indemnification', 'liability', 'termination', 'SLA',
      'data ownership', 'intellectual property', 'warranty',
      'jurisdiction', 'auto-renewal', 'disclaimer',
      'data processing', 'security',
    ],
    difficulty: 'medium',
  },

  // --- Education ---
  {
    id: 'edu-teach-recursion',
    name: 'Education: Teaching Recursion',
    domain: 'education',
    prompt:
      'Teach the concept of recursion to a beginner programmer. Use at least 2 examples with increasing complexity, provide visual representations, and include practice problems.',
    expectedTopics: [
      'base case', 'recursive case', 'call stack', 'factorial',
      'fibonacci', 'example', 'practice', 'tree', 'iteration',
      'step-by-step', 'return',
    ],
    difficulty: 'easy',
  },

  // --- Data ---
  {
    id: 'dat-query-optimization',
    name: 'SQL: Query Optimization',
    domain: 'data',
    prompt:
      'A query joining orders, customers, and products tables takes 30 seconds on a 50M row orders table. Explain your systematic approach to diagnosing and fixing the performance issue. Provide example optimized queries.',
    expectedTopics: [
      'EXPLAIN', 'index', 'join', 'WHERE', 'execution plan',
      'sequential scan', 'covering index', 'partitioning',
      'denormalization', 'statistics', 'query rewrite', 'cache',
    ],
    difficulty: 'hard',
  },

  // --- Operations ---
  {
    id: 'ops-inventory',
    name: 'Supply Chain: Inventory Optimization',
    domain: 'operations',
    prompt:
      'Design an inventory optimization strategy for an e-commerce company with 5,000 SKUs, seasonal demand patterns, and 3 regional warehouses. Include safety stock calculations, reorder points, and ABC analysis.',
    expectedTopics: [
      'safety stock', 'reorder point', 'ABC analysis', 'EOQ',
      'lead time', 'demand forecast', 'seasonal', 'warehouse',
      'SKU', 'service level', 'carrying cost', 'stockout',
    ],
    difficulty: 'hard',
  },

  // --- Sports ---
  {
    id: 'spt-tournament-planning',
    name: 'Martial Arts: Tournament Planning',
    domain: 'sports',
    prompt:
      'Plan a regional karate tournament for 300 competitors across youth, adult, and senior divisions, covering both kata and kumite events. Include bracket formats, weight classes, scheduling, referee requirements, venue logistics, and safety protocols.',
    expectedTopics: [
      'bracket', 'division', 'weight class', 'kata', 'kumite',
      'referee', 'schedule', 'venue', 'safety', 'medical',
      'registration', 'scoring',
    ],
    difficulty: 'hard',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

/**
 * Score a response based on expected topic coverage, response length, and coherence.
 *
 * Scoring breakdown (0-100):
 *   - Topic coverage: up to 70 points (proportional to topics found)
 *   - Response length: up to 15 points (rewarding substantial responses)
 *   - Coherence bonus: up to 15 points (based on structure indicators)
 */
function scoreResponse(response: string, test: BenchmarkTest): { score: number; topicsCovered: string[] } {
  const responseLower = response.toLowerCase();

  // --- Topic coverage (70 points max) ---
  const topicsCovered: string[] = [];
  for (const topic of test.expectedTopics) {
    if (responseLower.includes(topic.toLowerCase())) {
      topicsCovered.push(topic);
    }
  }
  const topicRatio = topicsCovered.length / test.expectedTopics.length;
  const topicScore = Math.round(topicRatio * 70);

  // --- Response length (15 points max) ---
  // Reward responses between 200-2000 words
  const wordCount = response.split(/\s+/).length;
  let lengthScore: number;
  if (wordCount < 50) {
    lengthScore = 2;
  } else if (wordCount < 200) {
    lengthScore = Math.round((wordCount / 200) * 10);
  } else if (wordCount <= 2000) {
    lengthScore = 15;
  } else {
    // Slightly penalize very long responses
    lengthScore = 12;
  }

  // --- Coherence / structure (15 points max) ---
  let coherenceScore = 0;

  // Check for structural indicators
  const hasHeadings = /^#{1,3}\s/m.test(response) || /\*\*[^*]+\*\*/m.test(response);
  const hasBulletPoints = /^[\s]*[-*•]\s/m.test(response);
  const hasNumberedList = /^[\s]*\d+[.)]\s/m.test(response);
  const hasCodeBlock = /```/.test(response);
  const hasParagraphs = response.split('\n\n').length >= 3;

  if (hasHeadings) coherenceScore += 3;
  if (hasBulletPoints) coherenceScore += 3;
  if (hasNumberedList) coherenceScore += 3;
  if (hasCodeBlock) coherenceScore += 3;
  if (hasParagraphs) coherenceScore += 3;

  coherenceScore = Math.min(coherenceScore, 15);

  // --- Difficulty multiplier ---
  // Hard tests get a slight boost to normalize scores across difficulties
  let difficultyAdjustment = 0;
  if (test.difficulty === 'hard' && topicRatio >= 0.5) {
    difficultyAdjustment = 5;
  }

  const totalScore = Math.min(100, topicScore + lengthScore + coherenceScore + difficultyAdjustment);

  return { score: totalScore, topicsCovered };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a benchmark for a specific agent on one test or all tests.
 * If `testId` is provided, runs just that test; otherwise runs all tests.
 */
export async function runBenchmark(
  agentId: string,
  testId?: string
): Promise<BenchmarkResult[]> {
  const agent = getSpecializedAgent(agentId);
  if (!agent) {
    throw new Error(`Specialized agent not found: ${agentId}`);
  }

  const testsToRun = testId
    ? benchmarkTests.filter((t) => t.id === testId)
    : benchmarkTests;

  if (testId && testsToRun.length === 0) {
    throw new Error(`Benchmark test not found: ${testId}`);
  }

  const results: BenchmarkResult[] = [];

  for (const test of testsToRun) {
    const startTime = Date.now();

    const response = await chatCompletion(
      [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: test.prompt },
      ],
      {
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      }
    );

    const responseTime = Date.now() - startTime;
    const { score, topicsCovered } = scoreResponse(response.content, test);

    const result: BenchmarkResult = {
      agentId,
      testId: test.id,
      score,
      responseTime,
      response: response.content,
      topicsCovered,
      timestamp: now(),
    };

    benchmarkResults.push(result);
    results.push(result);
  }

  return results;
}

/**
 * Compare multiple agents on the same benchmark tests.
 * Returns results grouped by test, showing each agent's performance side-by-side.
 */
export async function compareBenchmarks(
  agentIds: string[]
): Promise<{
  comparison: Array<{
    testId: string;
    testName: string;
    results: Array<{
      agentId: string;
      agentName: string;
      score: number;
      responseTime: number;
      topicsCovered: string[];
    }>;
  }>;
  summary: Array<{
    agentId: string;
    agentName: string;
    averageScore: number;
    averageResponseTime: number;
    testsRun: number;
  }>;
}> {
  // Validate all agents exist
  const agents: SpecializedAgent[] = [];
  for (const id of agentIds) {
    const agent = getSpecializedAgent(id);
    if (!agent) {
      throw new Error(`Specialized agent not found: ${id}`);
    }
    agents.push(agent);
  }

  // Run benchmarks for each agent
  const allResults: Map<string, BenchmarkResult[]> = new Map();
  for (const agent of agents) {
    const results = await runBenchmark(agent.id);
    allResults.set(agent.id, results);
  }

  // Build comparison by test
  const comparison = benchmarkTests.map((test) => ({
    testId: test.id,
    testName: test.name,
    results: agents.map((agent) => {
      const agentResults = allResults.get(agent.id) || [];
      const testResult = agentResults.find((r) => r.testId === test.id);
      return {
        agentId: agent.id,
        agentName: agent.name,
        score: testResult?.score ?? 0,
        responseTime: testResult?.responseTime ?? 0,
        topicsCovered: testResult?.topicsCovered ?? [],
      };
    }),
  }));

  // Build summary per agent
  const summary = agents.map((agent) => {
    const agentResults = allResults.get(agent.id) || [];
    const scores = agentResults.map((r) => r.score);
    const times = agentResults.map((r) => r.responseTime);
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : 0;
    const avgTime = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;

    return {
      agentId: agent.id,
      agentName: agent.name,
      averageScore: avgScore,
      averageResponseTime: avgTime,
      testsRun: agentResults.length,
    };
  });

  return { comparison, summary };
}

/**
 * Get stored benchmark results, optionally filtered by agentId.
 */
export function getBenchmarkResults(agentId?: string): BenchmarkResult[] {
  if (agentId) {
    return benchmarkResults.filter((r) => r.agentId === agentId);
  }
  return [...benchmarkResults];
}

/**
 * Get a summary of benchmark results for a specific agent.
 */
export function getAgentBenchmarkSummary(agentId: string): {
  agentId: string;
  testsCompleted: number;
  averageScore: number;
  highestScore: { testId: string; score: number } | null;
  lowestScore: { testId: string; score: number } | null;
  averageResponseTime: number;
  scoresByDomain: Record<string, number>;
  scoresByDifficulty: Record<string, number>;
} {
  const agent = getSpecializedAgent(agentId);
  if (!agent) {
    throw new Error(`Specialized agent not found: ${agentId}`);
  }

  const results = benchmarkResults.filter((r) => r.agentId === agentId);

  if (results.length === 0) {
    return {
      agentId,
      testsCompleted: 0,
      averageScore: 0,
      highestScore: null,
      lowestScore: null,
      averageResponseTime: 0,
      scoresByDomain: {},
      scoresByDifficulty: {},
    };
  }

  const scores = results.map((r) => r.score);
  const averageScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  const avgTime = Math.round(results.map((r) => r.responseTime).reduce((a, b) => a + b, 0) / results.length);

  // Highest and lowest
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const highestScore = { testId: sorted[0].testId, score: sorted[0].score };
  const lowestScore = {
    testId: sorted[sorted.length - 1].testId,
    score: sorted[sorted.length - 1].score,
  };

  // Score by domain
  const scoresByDomain: Record<string, number[]> = {};
  const scoresByDifficulty: Record<string, number[]> = {};

  for (const result of results) {
    const test = benchmarkTests.find((t) => t.id === result.testId);
    if (test) {
      if (!scoresByDomain[test.domain]) scoresByDomain[test.domain] = [];
      scoresByDomain[test.domain].push(result.score);

      if (!scoresByDifficulty[test.difficulty]) scoresByDifficulty[test.difficulty] = [];
      scoresByDifficulty[test.difficulty].push(result.score);
    }
  }

  const avgByDomain: Record<string, number> = {};
  for (const [domain, domainScores] of Object.entries(scoresByDomain)) {
    avgByDomain[domain] =
      Math.round((domainScores.reduce((a, b) => a + b, 0) / domainScores.length) * 100) / 100;
  }

  const avgByDifficulty: Record<string, number> = {};
  for (const [diff, diffScores] of Object.entries(scoresByDifficulty)) {
    avgByDifficulty[diff] =
      Math.round((diffScores.reduce((a, b) => a + b, 0) / diffScores.length) * 100) / 100;
  }

  return {
    agentId,
    testsCompleted: results.length,
    averageScore,
    highestScore,
    lowestScore,
    averageResponseTime: avgTime,
    scoresByDomain: avgByDomain,
    scoresByDifficulty: avgByDifficulty,
  };
}

/**
 * Get the list of all available benchmark tests.
 */
export function listBenchmarkTests(domain?: string): BenchmarkTest[] {
  if (domain) {
    return benchmarkTests.filter((t) => t.domain === domain);
  }
  return [...benchmarkTests];
}
