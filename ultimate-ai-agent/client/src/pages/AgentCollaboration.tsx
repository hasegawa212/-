import { useState, useEffect, useRef } from "react";
import {
  Users,
  MessageSquare,
  Zap,
  Brain,
  Target,
  Play,
  Pause,
  Sparkles,
  X,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// Domain colors for agent name coloring
const domainTextColors: Record<string, string> = {
  engineering: "text-blue-400",
  business: "text-emerald-400",
  creative: "text-purple-400",
  science: "text-cyan-400",
  health: "text-rose-400",
  legal: "text-amber-400",
  education: "text-orange-400",
  data: "text-indigo-400",
  security: "text-red-400",
  operations: "text-teal-400",
};

interface AgentOption {
  id: string;
  name: string;
  domain: string;
  avatar: string;
}

const agentOptions: AgentOption[] = [
  { id: "fullstack-architect", name: "Full-Stack Architect", domain: "engineering", avatar: "\u{1f3d7}\u{fe0f}" },
  { id: "devops-engineer", name: "DevOps Engineer", domain: "engineering", avatar: "\u{2699}\u{fe0f}" },
  { id: "security-analyst", name: "Security Analyst", domain: "engineering", avatar: "\u{1f6e1}\u{fe0f}" },
  { id: "mobile-developer", name: "Mobile Developer", domain: "engineering", avatar: "\u{1f4f1}" },
  { id: "startup-advisor", name: "Startup Advisor", domain: "business", avatar: "\u{1f680}" },
  { id: "marketing-strategist", name: "Marketing Strategist", domain: "business", avatar: "\u{1f4c8}" },
  { id: "financial-analyst", name: "Financial Analyst", domain: "business", avatar: "\u{1f4b0}" },
  { id: "project-manager", name: "Project Manager", domain: "business", avatar: "\u{1f4cb}" },
  { id: "ux-designer", name: "UX Designer", domain: "creative", avatar: "\u{1f3a8}" },
  { id: "copywriter", name: "Copywriter", domain: "creative", avatar: "\u{270d}\u{fe0f}" },
  { id: "video-producer", name: "Video Producer", domain: "creative", avatar: "\u{1f3ac}" },
  { id: "research-scientist", name: "Research Scientist", domain: "science", avatar: "\u{1f52c}" },
  { id: "data-scientist", name: "Data Scientist", domain: "science", avatar: "\u{1f4ca}" },
  { id: "biotech-advisor", name: "Biotech Advisor", domain: "science", avatar: "\u{1f9ec}" },
  { id: "health-coach", name: "Health Coach", domain: "health", avatar: "\u{1f4aa}" },
  { id: "mental-health-guide", name: "Mental Health Guide", domain: "health", avatar: "\u{1f9e0}" },
  { id: "legal-advisor", name: "Legal Advisor", domain: "legal", avatar: "\u{2696}\u{fe0f}" },
  { id: "language-tutor", name: "Language Tutor", domain: "education", avatar: "\u{1f310}" },
  { id: "academic-tutor", name: "Academic Tutor", domain: "education", avatar: "\u{1f4da}" },
  { id: "sql-expert", name: "SQL Expert", domain: "data", avatar: "\u{1f5c4}\u{fe0f}" },
  { id: "privacy-officer", name: "Privacy Officer", domain: "security", avatar: "\u{1f512}" },
  { id: "supply-chain-analyst", name: "Supply Chain Analyst", domain: "operations", avatar: "\u{1f69b}" },
];

interface CollaborationMode {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const collaborationModes: CollaborationMode[] = [
  {
    id: "debate",
    name: "Debate",
    description: "Agents present opposing viewpoints and argue their positions to explore a topic thoroughly.",
    icon: <Zap className="h-6 w-6" />,
  },
  {
    id: "brainstorm",
    name: "Brainstorm",
    description: "Agents build on each other's ideas collaboratively to generate creative solutions.",
    icon: <Brain className="h-6 w-6" />,
  },
  {
    id: "review",
    name: "Review",
    description: "Agents analyze and critique a proposal or document from their domain expertise.",
    icon: <Target className="h-6 w-6" />,
  },
  {
    id: "pipeline",
    name: "Pipeline",
    description: "Agents process sequentially, each building on the previous agent's output.",
    icon: <Sparkles className="h-6 w-6" />,
  },
];

interface CollaborationMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  agentDomain: string;
  content: string;
  timestamp: Date;
}

// Mock response generator based on mode and agent
function generateMockResponses(
  selectedAgents: AgentOption[],
  mode: string,
  topic: string
): CollaborationMessage[] {
  const mockResponsesByMode: Record<string, Record<string, string>> = {
    debate: {
      "fullstack-architect":
        `From an architectural perspective, **${topic}** requires careful consideration of scalability patterns. I'd argue for a microservices approach with event-driven communication. The monolithic alternative, while simpler initially, creates technical debt that compounds over time.\n\nKey architectural concerns:\n- Service boundary definition\n- Data consistency across services\n- API gateway pattern for client communication`,
      "devops-engineer":
        `I'd push back on the microservices-first approach. For **${topic}**, we need to consider operational complexity. Each microservice adds deployment, monitoring, and debugging overhead.\n\nA modular monolith gives us:\n- Simpler deployment pipeline\n- Easier debugging and tracing\n- Lower infrastructure costs\n- We can always extract services later when scale demands it`,
      "security-analyst":
        `Both approaches have security implications for **${topic}**. With microservices, the attack surface increases significantly - more network calls mean more opportunities for interception.\n\nSecurity recommendations regardless of architecture:\n- Zero-trust network model\n- Service mesh with mTLS\n- Centralized authentication with token propagation\n- Regular security audits of all service boundaries`,
      "startup-advisor":
        `Let me bring a business perspective to **${topic}**. The architecture decision should align with your growth stage. Pre-product-market-fit companies should optimize for speed, not scalability.\n\nMy recommendation:\n- Start monolithic for faster iteration\n- Plan for extraction points\n- Focus engineering effort on customer-facing features`,
      "data-scientist":
        `Looking at **${topic}** from a data perspective, the architecture choice significantly impacts our ability to build ML pipelines and analytics.\n\nConsiderations:\n- Data lake vs. distributed data stores\n- Real-time vs. batch processing needs\n- Feature store accessibility\n- Model serving infrastructure requirements`,
      default:
        `Regarding **${topic}**, I'd like to contribute my domain perspective. There are multiple valid approaches, and the right choice depends heavily on context, team expertise, and business requirements. We should weigh trade-offs carefully before committing to a direction.`,
    },
    brainstorm: {
      "ux-designer":
        `Love this brainstorm on **${topic}**! From a UX perspective, I see several exciting possibilities:\n\n1. **Adaptive interfaces** that learn user preferences over time\n2. **Micro-interactions** that provide delightful feedback\n3. **Progressive disclosure** to reduce cognitive load\n\nWhat if we combined AI-driven personalization with accessibility-first design?`,
      "copywriter":
        `Building on the UX ideas for **${topic}** - the narrative is crucial! Here's what I'm thinking:\n\n- **Storytelling-driven onboarding** that makes users the hero\n- **Contextual microcopy** that guides without overwhelming\n- **Voice & tone system** that adapts to user emotional state\n\nThe intersection of great copy and great UX is where magic happens.`,
      "marketing-strategist":
        `These are brilliant ideas for **${topic}**! Let me add the growth angle:\n\n- **Viral loops** built into the core UX\n- **Social proof integration** at key decision points\n- **Community-driven content** that keeps users engaged\n- **Referral mechanics** that feel natural, not forced\n\nWe could create a flywheel effect where better UX drives organic growth.`,
      "project-manager":
        `Great ideas flying around for **${topic}**! Let me help organize them into actionable phases:\n\n**Phase 1 (Quick wins):** Micro-interactions + microcopy improvements\n**Phase 2 (Medium effort):** Storytelling onboarding + social proof\n**Phase 3 (Strategic):** AI personalization + viral loops\n\nThis gives us early wins while building toward the bigger vision.`,
      "mobile-developer":
        `For **${topic}**, I'd add mobile-specific brainstorms:\n\n- **Haptic feedback patterns** for engagement\n- **Gesture-based navigation** for power users\n- **Offline-first** for reliability\n- **Widget integration** for at-a-glance value\n\nMobile is where most users will experience this first.`,
      default:
        `For **${topic}**, here's my brainstorm contribution:\n\n- We could leverage emerging patterns in our domain\n- Cross-pollinating ideas from adjacent fields could unlock innovation\n- User feedback loops should inform our next iteration\n\nExcited to see where this collaboration leads!`,
    },
    review: {
      "security-analyst":
        `**Security Review for ${topic}:**\n\n**Critical Issues:**\n- Authentication flow needs PKCE for public clients\n- Missing rate limiting on sensitive endpoints\n\n**Recommendations:**\n- Implement CSP headers\n- Add input validation at all boundaries\n- Enable audit logging for compliance\n\n**Rating: 6/10** - Solid foundation but needs security hardening.`,
      "legal-advisor":
        `**Legal Review for ${topic}:**\n\n**Compliance Gaps:**\n- Privacy policy needs updating for new data collection\n- Cookie consent mechanism doesn't meet GDPR requirements\n- Terms of service missing arbitration clause\n\n**Action Items:**\n- Data processing agreement for third-party integrations\n- Privacy impact assessment before launch\n\n**Rating: 5/10** - Significant legal work needed before go-live.`,
      "financial-analyst":
        `**Financial Review for ${topic}:**\n\n**Cost Analysis:**\n- Projected infrastructure costs: $2,400/month at launch\n- Scaling to 10K users: ~$8,500/month\n- Break-even at ~500 paying users\n\n**Concerns:**\n- Customer acquisition cost assumptions seem optimistic\n- Missing contingency budget\n\n**Rating: 7/10** - Financials are reasonable with some adjustments needed.`,
      "fullstack-architect":
        `**Architecture Review for ${topic}:**\n\n**Strengths:**\n- Clean separation of concerns\n- Good API design patterns\n- Appropriate technology choices\n\n**Areas for Improvement:**\n- Missing caching strategy\n- No circuit breaker pattern for external services\n- Database indexing strategy needed\n\n**Rating: 7/10** - Well-designed with room for optimization.`,
      "project-manager":
        `**Project Review for ${topic}:**\n\n**Timeline Assessment:**\n- Scope appears underestimated by ~30%\n- Missing dependency on third-party API approval\n- Testing phase seems compressed\n\n**Risk Matrix:**\n- High: Integration complexity\n- Medium: Team capacity during holidays\n- Low: Technology risk\n\n**Rating: 6/10** - Needs timeline adjustment and risk mitigation plan.`,
      default:
        `**Domain Review for ${topic}:**\n\nFrom my perspective, the proposal shows promise but needs refinement:\n\n**Strengths:** Clear objectives, good initial approach\n**Gaps:** Missing consideration of edge cases in my domain\n**Recommendation:** Schedule a deeper dive on domain-specific requirements\n\n**Rating: 6/10** - Good start, needs domain-specific refinement.`,
    },
    pipeline: {
      "fullstack-architect":
        `**[Stage 1: Architecture Design]** for ${topic}\n\nI've defined the system architecture:\n- Three-tier architecture with React frontend, Node.js API, PostgreSQL database\n- RESTful API with OpenAPI specification\n- WebSocket for real-time features\n- Redis for caching and session management\n\n*Passing architectural blueprint to the next stage...*`,
      "devops-engineer":
        `**[Stage 2: Infrastructure Setup]** for ${topic}\n\nBuilding on the architecture blueprint, I've designed the infrastructure:\n- Docker containers for each service\n- Kubernetes cluster on AWS EKS\n- CI/CD pipeline with GitHub Actions\n- Terraform modules for infrastructure as code\n- Prometheus + Grafana for monitoring\n\n*Passing deployment specification to the next stage...*`,
      "security-analyst":
        `**[Stage 3: Security Hardening]** for ${topic}\n\nApplying security layers to the infrastructure:\n- WAF rules configured for OWASP Top 10\n- Secrets management via AWS Secrets Manager\n- Network policies restricting pod-to-pod communication\n- Automated vulnerability scanning in CI pipeline\n- Incident response runbook created\n\n*Passing secured system to the next stage...*`,
      "project-manager":
        `**[Stage 4: Delivery Planning]** for ${topic}\n\nFinalizing the delivery plan for the complete system:\n- Sprint 1-2: Core API + database setup\n- Sprint 3-4: Frontend development + integration\n- Sprint 5: Security audit + performance testing\n- Sprint 6: Staging deployment + UAT\n- Go-live: End of Sprint 7\n\n*Pipeline complete. System ready for development kickoff.*`,
      "data-scientist":
        `**[Stage: Data Pipeline]** for ${topic}\n\nDesigning the data layer based on architecture specs:\n- ETL pipelines using Apache Airflow\n- Data warehouse on BigQuery for analytics\n- Feature store for ML model inputs\n- Real-time streaming with Kafka\n- Data quality checks at each pipeline stage\n\n*Passing data architecture to the next stage...*`,
      default:
        `**[Stage: Domain Input]** for ${topic}\n\nAdding domain-specific requirements to the pipeline:\n- Identified key requirements from my expertise area\n- Documented integration points with other stages\n- Provided validation criteria for my domain\n\n*Passing enriched specification to the next stage...*`,
    },
  };

  return selectedAgents.map((agent, index) => {
    const modeResponses = mockResponsesByMode[mode] || mockResponsesByMode.brainstorm;
    const content = modeResponses[agent.id] || modeResponses.default;

    return {
      id: `msg-${index}-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      agentAvatar: agent.avatar,
      agentDomain: agent.domain,
      content: content,
      timestamp: new Date(Date.now() + index * 2000),
    };
  });
}

export default function AgentCollaboration() {
  const [selectedAgents, setSelectedAgents] = useState<AgentOption[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>("brainstorm");
  const [topic, setTopic] = useState("");
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [roundCount, setRoundCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleAgent = (agent: AgentOption) => {
    setSelectedAgents((prev) => {
      const exists = prev.find((a) => a.id === agent.id);
      if (exists) {
        return prev.filter((a) => a.id !== agent.id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, agent];
    });
  };

  const startCollaboration = () => {
    if (selectedAgents.length < 2 || !topic.trim()) return;
    setIsCollaborating(true);
    setRoundCount(1);
    const newMessages = generateMockResponses(selectedAgents, selectedMode, topic.trim());
    setMessages(newMessages);
    setVisibleMessages(0);
  };

  // Animate messages appearing one by one
  useEffect(() => {
    if (!isCollaborating || isPaused) return;
    if (visibleMessages >= messages.length) return;

    const timer = setTimeout(() => {
      setVisibleMessages((prev) => prev + 1);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isCollaborating, visibleMessages, messages.length, isPaused]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  const handleNextRound = () => {
    const nextRound = roundCount + 1;
    setRoundCount(nextRound);
    const newMessages = generateMockResponses(
      selectedAgents,
      selectedMode,
      `${topic.trim()} (Round ${nextRound})`
    );
    const updatedMessages = [...messages, ...newMessages];
    setMessages(updatedMessages);
    setIsPaused(false);
  };

  const handleEndSession = () => {
    setIsCollaborating(false);
    setMessages([]);
    setVisibleMessages(0);
    setRoundCount(0);
    setIsPaused(false);
  };

  // Compute summary from visible messages
  const summaryByAgent = selectedAgents.map((agent) => {
    const agentMessages = messages
      .slice(0, visibleMessages)
      .filter((m) => m.agentId === agent.id);
    const keyPoint =
      agentMessages.length > 0
        ? agentMessages[agentMessages.length - 1].content.split("\n")[0].replace(/\*\*/g, "").replace(/[#[\]]/g, "").trim()
        : "Waiting for response...";
    return {
      agent,
      keyPoint,
      messageCount: agentMessages.length,
    };
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Agent Collaboration
        </h1>
        <p className="text-muted-foreground mt-1">
          Bring multiple AI agents together to solve complex problems through structured collaboration.
        </p>
      </div>

      {!isCollaborating ? (
        /* Setup Panel */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Agents</CardTitle>
              <CardDescription>
                Choose 2-5 agents to collaborate ({selectedAgents.length}/5 selected)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
                {agentOptions.map((agent) => {
                  const isSelected = selectedAgents.some((a) => a.id === agent.id);
                  const isDisabled = !isSelected && selectedAgents.length >= 5;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => !isDisabled && toggleAgent(agent)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : isDisabled
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-xl">{agent.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{agent.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{agent.domain}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Mode Selector + Topic */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Collaboration Mode</CardTitle>
                <CardDescription>How should the agents interact?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {collaborationModes.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setSelectedMode(mode.id)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        selectedMode === mode.id
                          ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
                          : "hover:bg-muted/50 border-border"
                      }`}
                    >
                      <div className={`mb-2 ${selectedMode === mode.id ? "text-primary" : "text-muted-foreground"}`}>
                        {mode.icon}
                      </div>
                      <div className="text-sm font-semibold">{mode.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {mode.description}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Topic / Prompt</CardTitle>
                <CardDescription>What should the agents collaborate on?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="e.g., Design a scalable architecture for a real-time collaboration tool like Figma..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="min-h-[120px]"
                />
                <Button
                  className="w-full"
                  size="lg"
                  disabled={selectedAgents.length < 2 || !topic.trim()}
                  onClick={startCollaboration}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Collaboration
                  {selectedAgents.length < 2 && (
                    <span className="ml-2 text-xs opacity-70">(select at least 2 agents)</span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Collaboration View */
        <div className="space-y-6">
          {/* Collaboration Header */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {selectedAgents.map((agent) => (
                      <span
                        key={agent.id}
                        className="text-2xl bg-card border-2 border-background rounded-full w-10 h-10 flex items-center justify-center"
                        title={agent.name}
                      >
                        {agent.avatar}
                      </span>
                    ))}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {collaborationModes.find((m) => m.id === selectedMode)?.name} Mode
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Round {roundCount} &middot; {visibleMessages}/{messages.length} messages
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPaused(!isPaused)}
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-3.5 w-3.5 mr-1" /> Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNextRound}
                    disabled={visibleMessages < messages.length}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Next Round
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleEndSession}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    End Session
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Topic Display */}
          <div className="bg-muted/30 border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Topic</div>
            <p className="text-sm">{topic}</p>
          </div>

          {/* Messages */}
          <div className="space-y-4">
            {messages.slice(0, visibleMessages).map((msg, index) => {
              const domainColor = domainTextColors[msg.agentDomain] || "text-foreground";
              return (
                <div
                  key={msg.id}
                  className="animate-in slide-in-from-bottom-2 fade-in duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl flex-shrink-0 mt-0.5">{msg.agentAvatar}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-semibold ${domainColor}`}>
                              {msg.agentName}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                              {msg.agentDomain}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                            {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) => {
                              if (part.startsWith("**") && part.endsWith("**")) {
                                return (
                                  <strong key={i} className="text-foreground font-semibold">
                                    {part.slice(2, -2)}
                                  </strong>
                                );
                              }
                              return <span key={i}>{part}</span>;
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}

            {/* Typing indicator */}
            {visibleMessages < messages.length && !isPaused && (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-2xl">
                  {messages[visibleMessages]?.agentAvatar}
                </span>
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {messages[visibleMessages]?.agentName} is thinking...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Summary Panel */}
          {visibleMessages > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Collaboration Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summaryByAgent.map(({ agent, keyPoint, messageCount }) => (
                    <div
                      key={agent.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <span className="text-xl flex-shrink-0">{agent.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${domainTextColors[agent.domain]}`}>
                            {agent.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {messageCount} message{messageCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {keyPoint}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
