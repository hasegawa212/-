import { useState } from "react";
import {
  Star,
  Trophy,
  TrendingUp,
  Users,
  MessageSquare,
  Zap,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  X,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// Agent data for evolution tracking
interface AgentEvolutionData {
  id: string;
  name: string;
  avatar: string;
  domain: string;
  rating: number;
  interactions: number;
  evolutionLevel: number;
  strengths: string[];
  improvements: string[];
  categoryRatings: Record<string, number>;
}

const domainBadgeColors: Record<string, string> = {
  engineering: "bg-blue-500/20 text-blue-400",
  business: "bg-emerald-500/20 text-emerald-400",
  creative: "bg-purple-500/20 text-purple-400",
  science: "bg-cyan-500/20 text-cyan-400",
  health: "bg-rose-500/20 text-rose-400",
  legal: "bg-amber-500/20 text-amber-400",
  education: "bg-orange-500/20 text-orange-400",
  data: "bg-indigo-500/20 text-indigo-400",
  security: "bg-red-500/20 text-red-400",
  operations: "bg-teal-500/20 text-teal-400",
};

const agentEvolutionData: AgentEvolutionData[] = [
  {
    id: "academic-tutor",
    name: "Academic Tutor",
    avatar: "\u{1f4da}",
    domain: "education",
    rating: 4.7,
    interactions: 32400,
    evolutionLevel: 9,
    strengths: ["Step-by-step explanations", "Multi-subject coverage", "Patience with learners"],
    improvements: ["Advanced research topics", "Peer-reviewed citation accuracy"],
    categoryRatings: { accuracy: 4.8, helpfulness: 4.9, clarity: 4.7, depth: 4.5, speed: 4.6 },
  },
  {
    id: "language-tutor",
    name: "Language Tutor",
    avatar: "\u{1f310}",
    domain: "education",
    rating: 4.8,
    interactions: 25600,
    evolutionLevel: 9,
    strengths: ["Conversational practice", "Cultural context", "Pronunciation guidance"],
    improvements: ["Rare dialects", "Advanced literary analysis"],
    categoryRatings: { accuracy: 4.7, helpfulness: 4.9, clarity: 4.8, depth: 4.6, speed: 4.8 },
  },
  {
    id: "mental-health-guide",
    name: "Mental Health Guide",
    avatar: "\u{1f9e0}",
    domain: "health",
    rating: 4.9,
    interactions: 21300,
    evolutionLevel: 10,
    strengths: ["Empathetic responses", "Evidence-based techniques", "Crisis resource awareness"],
    improvements: ["Cultural sensitivity nuances", "Integration with therapy approaches"],
    categoryRatings: { accuracy: 4.8, helpfulness: 5.0, clarity: 4.9, depth: 4.7, speed: 4.8 },
  },
  {
    id: "health-coach",
    name: "Health Coach",
    avatar: "\u{1f4aa}",
    domain: "health",
    rating: 4.6,
    interactions: 18500,
    evolutionLevel: 8,
    strengths: ["Personalized programs", "Nutrition planning", "Motivation techniques"],
    improvements: ["Injury rehabilitation protocols", "Sport-specific training"],
    categoryRatings: { accuracy: 4.5, helpfulness: 4.8, clarity: 4.6, depth: 4.4, speed: 4.7 },
  },
  {
    id: "fullstack-architect",
    name: "Full-Stack Architect",
    avatar: "\u{1f3d7}\u{fe0f}",
    domain: "engineering",
    rating: 4.8,
    interactions: 15420,
    evolutionLevel: 9,
    strengths: ["System design", "Code review quality", "Technology selection"],
    improvements: ["Emerging frameworks coverage", "Cost estimation accuracy"],
    categoryRatings: { accuracy: 4.9, helpfulness: 4.8, clarity: 4.7, depth: 4.9, speed: 4.5 },
  },
  {
    id: "data-scientist",
    name: "Data Scientist",
    avatar: "\u{1f4ca}",
    domain: "science",
    rating: 4.8,
    interactions: 14200,
    evolutionLevel: 8,
    strengths: ["Model selection guidance", "Statistical rigor", "Visualization advice"],
    improvements: ["Domain-specific ML applications", "Real-time inference patterns"],
    categoryRatings: { accuracy: 4.9, helpfulness: 4.7, clarity: 4.6, depth: 4.9, speed: 4.5 },
  },
  {
    id: "copywriter",
    name: "Copywriter",
    avatar: "\u{270d}\u{fe0f}",
    domain: "creative",
    rating: 4.6,
    interactions: 13100,
    evolutionLevel: 7,
    strengths: ["Brand voice consistency", "Conversion copy", "Email sequences"],
    improvements: ["Industry-specific jargon", "Long-form content stamina"],
    categoryRatings: { accuracy: 4.4, helpfulness: 4.7, clarity: 4.8, depth: 4.3, speed: 4.8 },
  },
  {
    id: "devops-engineer",
    name: "DevOps Engineer",
    avatar: "\u{2699}\u{fe0f}",
    domain: "engineering",
    rating: 4.7,
    interactions: 12300,
    evolutionLevel: 8,
    strengths: ["CI/CD pipeline design", "Container orchestration", "Cloud platform expertise"],
    improvements: ["Multi-cloud strategies", "FinOps optimization"],
    categoryRatings: { accuracy: 4.8, helpfulness: 4.7, clarity: 4.5, depth: 4.8, speed: 4.6 },
  },
  {
    id: "sql-expert",
    name: "SQL Expert",
    avatar: "\u{1f5c4}\u{fe0f}",
    domain: "data",
    rating: 4.8,
    interactions: 11800,
    evolutionLevel: 8,
    strengths: ["Query optimization", "Schema design", "Cross-platform SQL"],
    improvements: ["NoSQL hybrid patterns", "Graph database queries"],
    categoryRatings: { accuracy: 4.9, helpfulness: 4.8, clarity: 4.7, depth: 4.8, speed: 4.7 },
  },
  {
    id: "startup-advisor",
    name: "Startup Advisor",
    avatar: "\u{1f680}",
    domain: "business",
    rating: 4.7,
    interactions: 11200,
    evolutionLevel: 8,
    strengths: ["Business model validation", "Pitch deck feedback", "Market analysis"],
    improvements: ["Industry-specific regulations", "International expansion strategies"],
    categoryRatings: { accuracy: 4.6, helpfulness: 4.8, clarity: 4.7, depth: 4.6, speed: 4.7 },
  },
  {
    id: "ux-designer",
    name: "UX Designer",
    avatar: "\u{1f3a8}",
    domain: "creative",
    rating: 4.7,
    interactions: 10500,
    evolutionLevel: 7,
    strengths: ["User flow analysis", "Accessibility expertise", "Design system guidance"],
    improvements: ["Animation/motion design", "AR/VR interface patterns"],
    categoryRatings: { accuracy: 4.6, helpfulness: 4.8, clarity: 4.8, depth: 4.5, speed: 4.7 },
  },
  {
    id: "marketing-strategist",
    name: "Marketing Strategist",
    avatar: "\u{1f4c8}",
    domain: "business",
    rating: 4.5,
    interactions: 9800,
    evolutionLevel: 7,
    strengths: ["SEO strategy", "Content calendars", "Growth metrics"],
    improvements: ["Paid advertising optimization", "Influencer marketing"],
    categoryRatings: { accuracy: 4.4, helpfulness: 4.6, clarity: 4.5, depth: 4.3, speed: 4.7 },
  },
];

// Remaining agents for full leaderboard
const additionalAgents: AgentEvolutionData[] = [
  { id: "security-analyst", name: "Security Analyst", avatar: "\u{1f6e1}\u{fe0f}", domain: "engineering", rating: 4.9, interactions: 8900, evolutionLevel: 8, strengths: ["Threat modeling", "Code auditing"], improvements: ["Cloud-native security"], categoryRatings: { accuracy: 5.0, helpfulness: 4.8, clarity: 4.7, depth: 4.9, speed: 4.6 } },
  { id: "project-manager", name: "Project Manager", avatar: "\u{1f4cb}", domain: "business", rating: 4.6, interactions: 8200, evolutionLevel: 7, strengths: ["Sprint planning", "Risk assessment"], improvements: ["Enterprise portfolio management"], categoryRatings: { accuracy: 4.5, helpfulness: 4.7, clarity: 4.6, depth: 4.4, speed: 4.8 } },
  { id: "mobile-developer", name: "Mobile Developer", avatar: "\u{1f4f1}", domain: "engineering", rating: 4.6, interactions: 7650, evolutionLevel: 7, strengths: ["Cross-platform development", "Performance optimization"], improvements: ["Wearable device development"], categoryRatings: { accuracy: 4.7, helpfulness: 4.6, clarity: 4.5, depth: 4.5, speed: 4.6 } },
  { id: "legal-advisor", name: "Legal Advisor", avatar: "\u{2696}\u{fe0f}", domain: "legal", rating: 4.7, interactions: 7100, evolutionLevel: 7, strengths: ["Contract review", "IP guidance"], improvements: ["International law variations"], categoryRatings: { accuracy: 4.8, helpfulness: 4.7, clarity: 4.6, depth: 4.7, speed: 4.5 } },
  { id: "financial-analyst", name: "Financial Analyst", avatar: "\u{1f4b0}", domain: "business", rating: 4.8, interactions: 6500, evolutionLevel: 7, strengths: ["Financial modeling", "Valuation methods"], improvements: ["Crypto/DeFi analysis"], categoryRatings: { accuracy: 4.9, helpfulness: 4.7, clarity: 4.6, depth: 4.8, speed: 4.5 } },
  { id: "privacy-officer", name: "Privacy Officer", avatar: "\u{1f512}", domain: "security", rating: 4.8, interactions: 5900, evolutionLevel: 6, strengths: ["GDPR compliance", "Privacy assessments"], improvements: ["Emerging privacy regulations"], categoryRatings: { accuracy: 4.9, helpfulness: 4.7, clarity: 4.6, depth: 4.8, speed: 4.6 } },
  { id: "video-producer", name: "Video Producer", avatar: "\u{1f3ac}", domain: "creative", rating: 4.5, interactions: 5200, evolutionLevel: 6, strengths: ["Script writing", "Content strategy"], improvements: ["Live production techniques"], categoryRatings: { accuracy: 4.4, helpfulness: 4.6, clarity: 4.5, depth: 4.3, speed: 4.7 } },
  { id: "research-scientist", name: "Research Scientist", avatar: "\u{1f52c}", domain: "science", rating: 4.9, interactions: 4800, evolutionLevel: 7, strengths: ["Experimental design", "Paper review"], improvements: ["Interdisciplinary connections"], categoryRatings: { accuracy: 5.0, helpfulness: 4.8, clarity: 4.7, depth: 4.9, speed: 4.4 } },
  { id: "supply-chain-analyst", name: "Supply Chain Analyst", avatar: "\u{1f69b}", domain: "operations", rating: 4.5, interactions: 4100, evolutionLevel: 5, strengths: ["Logistics optimization", "Demand forecasting"], improvements: ["Global supply chain disruptions"], categoryRatings: { accuracy: 4.5, helpfulness: 4.5, clarity: 4.4, depth: 4.4, speed: 4.6 } },
  { id: "biotech-advisor", name: "Biotech Advisor", avatar: "\u{1f9ec}", domain: "science", rating: 4.7, interactions: 3200, evolutionLevel: 5, strengths: ["Regulatory guidance", "Research methodology"], improvements: ["Clinical trial design"], categoryRatings: { accuracy: 4.8, helpfulness: 4.6, clarity: 4.5, depth: 4.8, speed: 4.4 } },
];

const allAgents = [...agentEvolutionData, ...additionalAgents].sort((a, b) => {
  if (b.rating !== a.rating) return b.rating - a.rating;
  return b.interactions - a.interactions;
});

// Mock feedback data
interface FeedbackEntry {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  rating: number;
  category: string;
  comment: string;
  timeAgo: string;
}

const mockFeedback: FeedbackEntry[] = [
  { id: "f1", agentId: "mental-health-guide", agentName: "Mental Health Guide", agentAvatar: "\u{1f9e0}", rating: 5, category: "helpfulness", comment: "Incredibly empathetic and provided practical mindfulness exercises that actually helped.", timeAgo: "2 hours ago" },
  { id: "f2", agentId: "fullstack-architect", agentName: "Full-Stack Architect", agentAvatar: "\u{1f3d7}\u{fe0f}", rating: 5, category: "accuracy", comment: "The system design recommendations were spot-on. Saved us weeks of architecture mistakes.", timeAgo: "4 hours ago" },
  { id: "f3", agentId: "academic-tutor", agentName: "Academic Tutor", agentAvatar: "\u{1f4da}", rating: 4, category: "clarity", comment: "Good explanations of calculus concepts, but could use more visual examples.", timeAgo: "6 hours ago" },
  { id: "f4", agentId: "security-analyst", agentName: "Security Analyst", agentAvatar: "\u{1f6e1}\u{fe0f}", rating: 5, category: "depth", comment: "Found three critical vulnerabilities in our auth flow that we completely missed.", timeAgo: "8 hours ago" },
  { id: "f5", agentId: "data-scientist", agentName: "Data Scientist", agentAvatar: "\u{1f4ca}", rating: 4, category: "helpfulness", comment: "Excellent model selection guidance. Helped us go from 78% to 94% accuracy.", timeAgo: "12 hours ago" },
  { id: "f6", agentId: "copywriter", agentName: "Copywriter", agentAvatar: "\u{270d}\u{fe0f}", rating: 5, category: "clarity", comment: "The landing page copy converted 3x better than our previous version. Amazing work.", timeAgo: "1 day ago" },
  { id: "f7", agentId: "startup-advisor", agentName: "Startup Advisor", agentAvatar: "\u{1f680}", rating: 4, category: "accuracy", comment: "Solid market analysis. The TAM calculation methodology was particularly useful.", timeAgo: "1 day ago" },
  { id: "f8", agentId: "language-tutor", agentName: "Language Tutor", agentAvatar: "\u{1f310}", rating: 5, category: "helpfulness", comment: "Conversational Japanese practice felt natural and encouraging. Great corrections.", timeAgo: "2 days ago" },
  { id: "f9", agentId: "sql-expert", agentName: "SQL Expert", agentAvatar: "\u{1f5c4}\u{fe0f}", rating: 5, category: "speed", comment: "Optimized our query from 12 seconds to 200ms. Incredible improvement.", timeAgo: "2 days ago" },
  { id: "f10", agentId: "devops-engineer", agentName: "DevOps Engineer", agentAvatar: "\u{2699}\u{fe0f}", rating: 4, category: "depth", comment: "CI/CD pipeline setup was thorough, but needed minor tweaks for our mono-repo.", timeAgo: "3 days ago" },
];

const feedbackCategories = ["accuracy", "helpfulness", "clarity", "depth", "speed"];
const ratingCategories = ["accuracy", "helpfulness", "clarity", "depth", "speed"];

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${starSize} ${
            i <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function InteractiveStarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              i <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ProgressBar({ value, max = 10 }: { value: number; max?: number }) {
  const percentage = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}/{max}</span>
    </div>
  );
}

function RatingBarChart({ ratings }: { ratings: Record<string, number> }) {
  const maxRating = 5;
  return (
    <div className="space-y-2">
      {Object.entries(ratings).map(([category, value]) => (
        <div key={category} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20 capitalize">{category}</span>
          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 flex items-center justify-end pr-1.5"
              style={{ width: `${(value / maxRating) * 100}%` }}
            >
              <span className="text-[10px] font-bold text-white">{value.toFixed(1)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AgentEvolution() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackAgent, setFeedbackAgent] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackCategory, setFeedbackCategory] = useState("helpfulness");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>(mockFeedback);
  const [selectedInsightAgent, setSelectedInsightAgent] = useState<string>(allAgents[0]?.id || "");

  // Computed stats
  const totalInteractions = allAgents.reduce((sum, a) => sum + a.interactions, 0);
  const averageRating = allAgents.reduce((sum, a) => sum + a.rating, 0) / allAgents.length;
  const topAgent = allAgents[0];
  const activeAgents = allAgents.length;

  const rankMedals: Record<number, { icon: string; color: string }> = {
    0: { icon: "\u{1f947}", color: "text-yellow-400" },
    1: { icon: "\u{1f948}", color: "text-gray-400" },
    2: { icon: "\u{1f949}", color: "text-amber-600" },
  };

  const handleSubmitFeedback = () => {
    if (!feedbackAgent || feedbackRating === 0 || !feedbackComment.trim()) return;
    const agent = allAgents.find((a) => a.id === feedbackAgent);
    if (!agent) return;
    const newEntry: FeedbackEntry = {
      id: `f-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      agentAvatar: agent.avatar,
      rating: feedbackRating,
      category: feedbackCategory,
      comment: feedbackComment.trim(),
      timeAgo: "Just now",
    };
    setFeedbackList([newEntry, ...feedbackList]);
    setShowFeedbackModal(false);
    setFeedbackAgent("");
    setFeedbackRating(0);
    setFeedbackCategory("helpfulness");
    setFeedbackComment("");
  };

  const insightAgent = allAgents.find((a) => a.id === selectedInsightAgent);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          Agent Evolution & Training
        </h1>
        <p className="text-muted-foreground mt-1">
          Track agent performance, provide feedback, and monitor evolution progress.
        </p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Interactions</p>
                <p className="text-2xl font-bold mt-1">{totalInteractions.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Average Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold">{averageRating.toFixed(2)}</p>
                  <StarRating rating={averageRating} />
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Top Agent</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl">{topAgent.avatar}</span>
                  <p className="text-lg font-bold truncate">{topAgent.name}</p>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Agents</p>
                <p className="text-2xl font-bold mt-1">{activeAgents}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Agent Leaderboard
          </CardTitle>
          <CardDescription>Ranked by rating and interaction volume</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-3 px-2 w-12">Rank</th>
                  <th className="text-left py-3 px-2">Agent</th>
                  <th className="text-left py-3 px-2 hidden sm:table-cell">Domain</th>
                  <th className="text-left py-3 px-2">Rating</th>
                  <th className="text-right py-3 px-2 hidden md:table-cell">Interactions</th>
                  <th className="text-left py-3 px-2 w-40 hidden lg:table-cell">Evolution Level</th>
                </tr>
              </thead>
              <tbody>
                {allAgents.map((agent, index) => {
                  const medal = rankMedals[index];
                  const isTopThree = index < 3;
                  return (
                    <tr
                      key={agent.id}
                      className={`border-b last:border-0 transition-colors hover:bg-muted/30 ${
                        isTopThree ? "bg-muted/10" : ""
                      }`}
                    >
                      <td className="py-3 px-2">
                        {medal ? (
                          <span className="text-lg">{medal.icon}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground font-medium pl-1">
                            {index + 1}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{agent.avatar}</span>
                          <span className={`text-sm font-medium ${isTopThree ? "font-semibold" : ""}`}>
                            {agent.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 hidden sm:table-cell">
                        <Badge className={`text-[10px] border-0 ${domainBadgeColors[agent.domain] || ""}`}>
                          {agent.domain.charAt(0).toUpperCase() + agent.domain.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5">
                          <StarRating rating={agent.rating} />
                          <span className="text-xs text-muted-foreground">{agent.rating.toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {agent.interactions.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-2 hidden lg:table-cell">
                        <ProgressBar value={agent.evolutionLevel} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Feedback + Evolution Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feedback Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Recent Feedback
                </CardTitle>
                <CardDescription>{feedbackList.length} feedback entries</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowFeedbackModal(true)}>
                <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                Give Feedback
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {feedbackList.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{entry.agentAvatar}</span>
                      <span className="text-sm font-medium">{entry.agentName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{entry.timeAgo}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <StarRating rating={entry.rating} />
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {entry.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.comment}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evolution Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Evolution Insights
            </CardTitle>
            <CardDescription>Per-agent performance analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Agent Selector */}
            <select
              value={selectedInsightAgent}
              onChange={(e) => setSelectedInsightAgent(e.target.value)}
              className="w-full text-sm bg-background border rounded-md px-3 py-2"
            >
              {allAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.avatar} {agent.name} ({agent.domain})
                </option>
              ))}
            </select>

            {insightAgent && (
              <div className="space-y-4">
                {/* Agent Header */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <span className="text-3xl">{insightAgent.avatar}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{insightAgent.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-[10px] border-0 ${domainBadgeColors[insightAgent.domain]}`}>
                        {insightAgent.domain.charAt(0).toUpperCase() + insightAgent.domain.slice(1)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Level {insightAgent.evolutionLevel}/10
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{insightAgent.rating.toFixed(1)}</div>
                    <StarRating rating={insightAgent.rating} />
                  </div>
                </div>

                {/* Category Ratings Chart */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Ratings by Category
                  </h4>
                  <RatingBarChart ratings={insightAgent.categoryRatings} />
                </div>

                {/* Strengths */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    Strengths
                  </h4>
                  <div className="space-y-1">
                    {insightAgent.strengths.map((s) => (
                      <div
                        key={s}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Zap className="h-3 w-3 text-green-500 flex-shrink-0" />
                        {s}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Improvement Areas */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-orange-500" />
                    Areas for Improvement
                  </h4>
                  <div className="space-y-1">
                    {insightAgent.improvements.map((s) => (
                      <div
                        key={s}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <TrendingUp className="h-3 w-3 text-orange-500 flex-shrink-0" />
                        {s}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evolution Progress */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Evolution Progress</h4>
                  <ProgressBar value={insightAgent.evolutionLevel} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {insightAgent.evolutionLevel >= 9
                      ? "Near mastery - this agent is among the highest evolved."
                      : insightAgent.evolutionLevel >= 7
                      ? "Advanced - consistently delivering high-quality responses."
                      : insightAgent.evolutionLevel >= 5
                      ? "Intermediate - showing steady improvement with each interaction."
                      : "Developing - gaining experience and refining capabilities."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Give Feedback</CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowFeedbackModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Help agents improve by sharing your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Agent Selector */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Agent</label>
                <select
                  value={feedbackAgent}
                  onChange={(e) => setFeedbackAgent(e.target.value)}
                  className="w-full text-sm bg-background border rounded-md px-3 py-2"
                >
                  <option value="">Select an agent...</option>
                  {allAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.avatar} {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Star Rating */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Rating</label>
                <InteractiveStarRating
                  value={feedbackRating}
                  onChange={setFeedbackRating}
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category</label>
                <select
                  value={feedbackCategory}
                  onChange={(e) => setFeedbackCategory(e.target.value)}
                  className="w-full text-sm bg-background border rounded-md px-3 py-2"
                >
                  {feedbackCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Comment */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Comment</label>
                <Textarea
                  placeholder="Share your experience with this agent..."
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              {/* Submit */}
              <Button
                className="w-full"
                onClick={handleSubmitFeedback}
                disabled={!feedbackAgent || feedbackRating === 0 || !feedbackComment.trim()}
              >
                Submit Feedback
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
