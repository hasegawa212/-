import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Star,
  Users,
  MessageSquare,
  Zap,
  ChevronRight,
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

// Domain color mappings
const domainColors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  engineering: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30", badge: "bg-blue-500/20 text-blue-400" },
  business: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-400" },
  creative: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/30", badge: "bg-purple-500/20 text-purple-400" },
  science: { bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/30", badge: "bg-cyan-500/20 text-cyan-400" },
  health: { bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/30", badge: "bg-rose-500/20 text-rose-400" },
  legal: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30", badge: "bg-amber-500/20 text-amber-400" },
  education: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30", badge: "bg-orange-500/20 text-orange-400" },
  data: { bg: "bg-indigo-500/10", text: "text-indigo-500", border: "border-indigo-500/30", badge: "bg-indigo-500/20 text-indigo-400" },
  security: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30", badge: "bg-red-500/20 text-red-400" },
  operations: { bg: "bg-teal-500/10", text: "text-teal-500", border: "border-teal-500/30", badge: "bg-teal-500/20 text-teal-400" },
};

const tierColors: Record<string, string> = {
  free: "bg-green-500/20 text-green-400 border-green-500/30",
  pro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  enterprise: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

interface Agent {
  id: string;
  name: string;
  domain: string;
  avatar: string;
  description: string;
  fullDescription: string;
  expertise: string[];
  tier: "free" | "pro" | "enterprise";
  sampleQuestions: string[];
  stats?: {
    interactions: number;
    rating: number;
  };
}

const agents: Agent[] = [
  {
    id: "fullstack-architect",
    name: "Full-Stack Architect",
    domain: "engineering",
    avatar: "\u{1f3d7}\u{fe0f}",
    description: "Designs and reviews full-stack application architectures with modern best practices.",
    fullDescription: "Expert in designing scalable, maintainable full-stack architectures. Specializes in microservices, monorepo strategies, API design, database modeling, and cloud-native patterns. Provides detailed code reviews and architectural decision records.",
    expertise: ["System Design", "API Architecture", "Database Modeling", "Cloud Native", "Microservices", "Performance"],
    tier: "free",
    sampleQuestions: [
      "Design a scalable e-commerce architecture",
      "Review my REST API design for best practices",
      "How should I structure a monorepo for 5 services?",
    ],
    stats: { interactions: 15420, rating: 4.8 },
  },
  {
    id: "devops-engineer",
    name: "DevOps Engineer",
    domain: "engineering",
    avatar: "\u{2699}\u{fe0f}",
    description: "CI/CD pipelines, infrastructure as code, and cloud deployment specialist.",
    fullDescription: "Comprehensive DevOps expertise covering CI/CD pipeline design, container orchestration with Kubernetes, infrastructure as code with Terraform and Pulumi, monitoring and observability, and cloud platform optimization across AWS, GCP, and Azure.",
    expertise: ["CI/CD", "Kubernetes", "Terraform", "Docker", "AWS", "Monitoring"],
    tier: "free",
    sampleQuestions: [
      "Set up a GitHub Actions CI/CD pipeline",
      "Design a Kubernetes deployment strategy",
      "How to implement blue-green deployments?",
    ],
    stats: { interactions: 12300, rating: 4.7 },
  },
  {
    id: "security-analyst",
    name: "Security Analyst",
    domain: "engineering",
    avatar: "\u{1f6e1}\u{fe0f}",
    description: "Application security, vulnerability assessment, and secure coding practices.",
    fullDescription: "Specializes in identifying and mitigating security vulnerabilities across web applications, APIs, and infrastructure. Provides OWASP-aligned security reviews, penetration testing guidance, and secure coding recommendations.",
    expertise: ["OWASP", "Penetration Testing", "Secure Coding", "Threat Modeling", "Encryption", "Auth"],
    tier: "pro",
    sampleQuestions: [
      "Review my authentication flow for vulnerabilities",
      "How to implement CSRF protection?",
      "Perform a threat model for my API",
    ],
    stats: { interactions: 8900, rating: 4.9 },
  },
  {
    id: "mobile-developer",
    name: "Mobile Developer",
    domain: "engineering",
    avatar: "\u{1f4f1}",
    description: "Cross-platform and native mobile development with React Native, Flutter, and Swift.",
    fullDescription: "Expert in building performant, beautiful mobile applications. Covers React Native, Flutter, Swift/SwiftUI, and Kotlin. Specializes in mobile UX patterns, offline-first architectures, push notifications, and app store optimization.",
    expertise: ["React Native", "Flutter", "Swift", "Kotlin", "Mobile UX", "App Store"],
    tier: "pro",
    sampleQuestions: [
      "Should I use React Native or Flutter?",
      "How to implement offline-first in mobile?",
      "Optimize my app's startup performance",
    ],
    stats: { interactions: 7650, rating: 4.6 },
  },
  {
    id: "startup-advisor",
    name: "Startup Advisor",
    domain: "business",
    avatar: "\u{1f680}",
    description: "Business strategy, fundraising, and go-to-market planning for startups.",
    fullDescription: "Seasoned startup advisor covering business model validation, pitch deck creation, fundraising strategy, go-to-market planning, competitive analysis, and scaling operations. Draws on patterns from thousands of successful startups.",
    expertise: ["Business Strategy", "Fundraising", "Go-to-Market", "Pitch Decks", "Competitive Analysis", "Scaling"],
    tier: "free",
    sampleQuestions: [
      "Review my startup pitch deck",
      "How to calculate my total addressable market?",
      "What fundraising strategy for a pre-seed startup?",
    ],
    stats: { interactions: 11200, rating: 4.7 },
  },
  {
    id: "marketing-strategist",
    name: "Marketing Strategist",
    domain: "business",
    avatar: "\u{1f4c8}",
    description: "Digital marketing, growth hacking, and brand strategy expert.",
    fullDescription: "Covers the full spectrum of digital marketing including SEO/SEM, content marketing, social media strategy, email campaigns, growth hacking, and brand positioning. Provides data-driven marketing plans and campaign optimization.",
    expertise: ["SEO", "Content Marketing", "Social Media", "Growth Hacking", "Brand Strategy", "Analytics"],
    tier: "free",
    sampleQuestions: [
      "Create a content marketing strategy for my SaaS",
      "How to improve my website's SEO?",
      "Design a product launch campaign",
    ],
    stats: { interactions: 9800, rating: 4.5 },
  },
  {
    id: "financial-analyst",
    name: "Financial Analyst",
    domain: "business",
    avatar: "\u{1f4b0}",
    description: "Financial modeling, valuation, and investment analysis specialist.",
    fullDescription: "Expert in financial modeling, company valuation, investment analysis, budgeting, and financial forecasting. Provides detailed financial projections, DCF analyses, and helps interpret financial statements and market trends.",
    expertise: ["Financial Modeling", "Valuation", "Investment Analysis", "Budgeting", "Forecasting", "Risk"],
    tier: "pro",
    sampleQuestions: [
      "Build a financial model for my startup",
      "How to value a pre-revenue company?",
      "Analyze these financial ratios",
    ],
    stats: { interactions: 6500, rating: 4.8 },
  },
  {
    id: "project-manager",
    name: "Project Manager",
    domain: "business",
    avatar: "\u{1f4cb}",
    description: "Agile project management, team coordination, and delivery optimization.",
    fullDescription: "Experienced in Agile, Scrum, and Kanban methodologies. Helps with sprint planning, backlog grooming, team velocity tracking, risk management, stakeholder communication, and project delivery optimization.",
    expertise: ["Agile", "Scrum", "Sprint Planning", "Risk Management", "Stakeholder Mgmt", "Delivery"],
    tier: "free",
    sampleQuestions: [
      "Help me plan a 3-month project roadmap",
      "How to run effective sprint retrospectives?",
      "Manage scope creep in my project",
    ],
    stats: { interactions: 8200, rating: 4.6 },
  },
  {
    id: "ux-designer",
    name: "UX Designer",
    domain: "creative",
    avatar: "\u{1f3a8}",
    description: "User experience design, wireframing, and usability testing expert.",
    fullDescription: "Specializes in user-centered design processes including user research, wireframing, prototyping, usability testing, design systems, and accessibility. Creates intuitive, beautiful interfaces that delight users.",
    expertise: ["User Research", "Wireframing", "Prototyping", "Usability Testing", "Design Systems", "A11y"],
    tier: "free",
    sampleQuestions: [
      "Review my app's user flow for usability issues",
      "How to design an effective onboarding experience?",
      "Create a design system for my product",
    ],
    stats: { interactions: 10500, rating: 4.7 },
  },
  {
    id: "copywriter",
    name: "Copywriter",
    domain: "creative",
    avatar: "\u{270d}\u{fe0f}",
    description: "Compelling copy, content strategy, and brand voice development.",
    fullDescription: "Crafts compelling copy across all mediums including website copy, email campaigns, social media, blog posts, ad copy, and product descriptions. Develops brand voice guidelines and content strategies that drive engagement and conversion.",
    expertise: ["Web Copy", "Email Campaigns", "Brand Voice", "Blog Writing", "Ad Copy", "Content Strategy"],
    tier: "free",
    sampleQuestions: [
      "Write landing page copy for my SaaS product",
      "Develop a brand voice guide for my startup",
      "Craft an email sequence for onboarding",
    ],
    stats: { interactions: 13100, rating: 4.6 },
  },
  {
    id: "video-producer",
    name: "Video Producer",
    domain: "creative",
    avatar: "\u{1f3ac}",
    description: "Video content strategy, scripting, and production planning.",
    fullDescription: "Expert in video content strategy covering YouTube, TikTok, Instagram Reels, and corporate video. Handles scripting, storyboarding, production planning, editing guidance, and video SEO optimization for maximum reach.",
    expertise: ["Video Strategy", "Scripting", "Storyboarding", "YouTube SEO", "Production", "Editing"],
    tier: "pro",
    sampleQuestions: [
      "Create a YouTube content strategy for my channel",
      "Write a script for a product demo video",
      "How to optimize my videos for discovery?",
    ],
    stats: { interactions: 5200, rating: 4.5 },
  },
  {
    id: "research-scientist",
    name: "Research Scientist",
    domain: "science",
    avatar: "\u{1f52c}",
    description: "Scientific research methodology, paper review, and experiment design.",
    fullDescription: "Assists with scientific research methodology, literature reviews, experimental design, statistical analysis, and paper writing. Covers multiple scientific domains with rigorous methodology and reproducibility standards.",
    expertise: ["Research Methods", "Experimental Design", "Statistical Analysis", "Paper Writing", "Lit Review", "Peer Review"],
    tier: "pro",
    sampleQuestions: [
      "Design an experiment to test my hypothesis",
      "Review my research methodology",
      "Help me write a compelling abstract",
    ],
    stats: { interactions: 4800, rating: 4.9 },
  },
  {
    id: "data-scientist",
    name: "Data Scientist",
    domain: "science",
    avatar: "\u{1f4ca}",
    description: "Machine learning, statistical modeling, and data analysis expert.",
    fullDescription: "Comprehensive data science expertise including machine learning model development, statistical modeling, feature engineering, data visualization, A/B testing, and MLOps. Proficient in Python, R, and modern ML frameworks.",
    expertise: ["Machine Learning", "Statistical Modeling", "Python", "Deep Learning", "Data Viz", "MLOps"],
    tier: "free",
    sampleQuestions: [
      "Help me choose the right ML model for my data",
      "How to handle imbalanced classification?",
      "Design an A/B testing framework",
    ],
    stats: { interactions: 14200, rating: 4.8 },
  },
  {
    id: "biotech-advisor",
    name: "Biotech Advisor",
    domain: "science",
    avatar: "\u{1f9ec}",
    description: "Biotechnology, genomics, and pharmaceutical development guidance.",
    fullDescription: "Advises on biotechnology research, genomics, CRISPR applications, pharmaceutical development pipelines, regulatory pathways (FDA, EMA), and biotech business strategy. Bridges the gap between science and commercialization.",
    expertise: ["Genomics", "CRISPR", "Drug Development", "FDA Regulatory", "Bioprocessing", "Clinical Trials"],
    tier: "enterprise",
    sampleQuestions: [
      "Explain the FDA approval pathway for biologics",
      "How does CRISPR-Cas9 gene editing work?",
      "Review my biotech startup business plan",
    ],
    stats: { interactions: 3200, rating: 4.7 },
  },
  {
    id: "health-coach",
    name: "Health Coach",
    domain: "health",
    avatar: "\u{1f4aa}",
    description: "Fitness planning, nutrition guidance, and wellness coaching.",
    fullDescription: "Provides evidence-based fitness programming, nutrition planning, recovery strategies, and holistic wellness coaching. Covers strength training, cardio, flexibility, meal planning, supplementation, and lifestyle optimization.",
    expertise: ["Fitness Plans", "Nutrition", "Strength Training", "Recovery", "Meal Planning", "Wellness"],
    tier: "free",
    sampleQuestions: [
      "Create a 12-week workout program for me",
      "Design a meal plan for muscle building",
      "How to improve my sleep quality?",
    ],
    stats: { interactions: 18500, rating: 4.6 },
  },
  {
    id: "mental-health-guide",
    name: "Mental Health Guide",
    domain: "health",
    avatar: "\u{1f9e0}",
    description: "Emotional wellness, stress management, and mindfulness practices.",
    fullDescription: "Offers guidance on emotional wellness, stress management, mindfulness, cognitive behavioral techniques, and mental health awareness. Provides coping strategies, meditation guidance, and resources for professional support.",
    expertise: ["Stress Management", "Mindfulness", "CBT Techniques", "Meditation", "Emotional Intelligence", "Self-Care"],
    tier: "free",
    sampleQuestions: [
      "Teach me a 5-minute mindfulness exercise",
      "How to manage work-related stress?",
      "What are effective journaling techniques?",
    ],
    stats: { interactions: 21300, rating: 4.9 },
  },
  {
    id: "legal-advisor",
    name: "Legal Advisor",
    domain: "legal",
    avatar: "\u{2696}\u{fe0f}",
    description: "Business law, contracts, IP, and regulatory compliance guidance.",
    fullDescription: "Provides guidance on business law, contract drafting and review, intellectual property protection, regulatory compliance, employment law, and corporate governance. Helps navigate complex legal landscapes for businesses and individuals.",
    expertise: ["Contract Law", "IP Protection", "Compliance", "Employment Law", "Corporate Gov", "Privacy Law"],
    tier: "pro",
    sampleQuestions: [
      "Review my SaaS terms of service",
      "How to protect my startup's intellectual property?",
      "What compliance requirements apply to my business?",
    ],
    stats: { interactions: 7100, rating: 4.7 },
  },
  {
    id: "language-tutor",
    name: "Language Tutor",
    domain: "education",
    avatar: "\u{1f310}",
    description: "Multi-language instruction with conversational practice and grammar.",
    fullDescription: "Interactive language learning covering Spanish, French, German, Japanese, Mandarin, and more. Provides conversational practice, grammar lessons, vocabulary building, pronunciation tips, and cultural context for effective language acquisition.",
    expertise: ["Spanish", "French", "Japanese", "Grammar", "Conversation", "Vocabulary"],
    tier: "free",
    sampleQuestions: [
      "Teach me basic Japanese phrases for travel",
      "Practice a conversation in Spanish with me",
      "Explain French verb conjugation rules",
    ],
    stats: { interactions: 25600, rating: 4.8 },
  },
  {
    id: "academic-tutor",
    name: "Academic Tutor",
    domain: "education",
    avatar: "\u{1f4da}",
    description: "Math, science, and humanities tutoring with step-by-step explanations.",
    fullDescription: "Comprehensive academic tutoring across mathematics, physics, chemistry, biology, history, and literature. Provides step-by-step explanations, practice problems, study strategies, and exam preparation guidance.",
    expertise: ["Mathematics", "Physics", "Chemistry", "Study Skills", "Exam Prep", "Essay Writing"],
    tier: "free",
    sampleQuestions: [
      "Explain calculus derivatives step by step",
      "Help me understand quantum mechanics basics",
      "How to write a strong thesis statement?",
    ],
    stats: { interactions: 32400, rating: 4.7 },
  },
  {
    id: "sql-expert",
    name: "SQL Expert",
    domain: "data",
    avatar: "\u{1f5c4}\u{fe0f}",
    description: "Database design, query optimization, and data management specialist.",
    fullDescription: "Expert in relational database design, SQL query writing and optimization, data warehousing, ETL processes, and database administration. Covers PostgreSQL, MySQL, SQL Server, and modern data platforms like Snowflake and BigQuery.",
    expertise: ["PostgreSQL", "Query Optimization", "Data Warehousing", "ETL", "Database Design", "BigQuery"],
    tier: "free",
    sampleQuestions: [
      "Optimize this slow SQL query",
      "Design a database schema for an e-commerce app",
      "How to implement efficient pagination?",
    ],
    stats: { interactions: 11800, rating: 4.8 },
  },
  {
    id: "privacy-officer",
    name: "Privacy Officer",
    domain: "security",
    avatar: "\u{1f512}",
    description: "Data privacy, GDPR compliance, and information security governance.",
    fullDescription: "Specializes in data privacy regulations including GDPR, CCPA, HIPAA, and SOC 2 compliance. Provides privacy impact assessments, data mapping, consent management strategies, and security governance frameworks.",
    expertise: ["GDPR", "CCPA", "HIPAA", "SOC 2", "Privacy Impact Assessment", "Data Mapping"],
    tier: "enterprise",
    sampleQuestions: [
      "Is my app GDPR compliant?",
      "How to implement cookie consent properly?",
      "Create a data privacy impact assessment",
    ],
    stats: { interactions: 5900, rating: 4.8 },
  },
  {
    id: "supply-chain-analyst",
    name: "Supply Chain Analyst",
    domain: "operations",
    avatar: "\u{1f69b}",
    description: "Supply chain optimization, logistics, and inventory management.",
    fullDescription: "Expert in supply chain optimization, demand forecasting, inventory management, logistics planning, vendor management, and procurement strategy. Uses data-driven approaches to reduce costs and improve operational efficiency.",
    expertise: ["Logistics", "Inventory Mgmt", "Demand Forecasting", "Procurement", "Vendor Mgmt", "Cost Optimization"],
    tier: "pro",
    sampleQuestions: [
      "How to optimize my inventory levels?",
      "Design a demand forecasting model",
      "Reduce shipping costs for my e-commerce business",
    ],
    stats: { interactions: 4100, rating: 4.5 },
  },
];

const domains = ["All", "Engineering", "Business", "Creative", "Science", "Health", "Legal", "Education", "Data", "Security", "Operations"];
const tiers = ["All", "Free", "Pro", "Enterprise"] as const;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function AgentMarketplace() {
  const navigate = useNavigate();
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [selectedTier, setSelectedTier] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Intersection observer for fade-in animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const agentId = entry.target.getAttribute("data-agent-id");
            if (agentId) {
              setVisibleCards((prev) => new Set(prev).add(agentId));
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    cardRefs.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [selectedDomain, selectedTier, searchQuery]);

  const filteredAgents = agents.filter((agent) => {
    const matchesDomain =
      selectedDomain === "All" ||
      agent.domain.toLowerCase() === selectedDomain.toLowerCase();
    const matchesTier =
      selectedTier === "All" ||
      agent.tier.toLowerCase() === selectedTier.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.expertise.some((e) => e.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDomain && matchesTier && matchesSearch;
  });

  const handleChatNow = (agentId: string) => {
    navigate(`/chat?agent=${agentId}`);
  };

  const handleSampleQuestion = (agentId: string, question: string) => {
    navigate(`/chat?agent=${agentId}&q=${encodeURIComponent(question)}`);
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-8 w-8 text-yellow-500" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Specialized AI Agents</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          22 domain-expert agents ready to work
        </p>
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {agents.reduce((sum, a) => sum + (a.stats?.interactions || 0), 0).toLocaleString()} total interactions
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4" />
            {agents.length} agents
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            {(agents.reduce((sum, a) => sum + (a.stats?.rating || 0), 0) / agents.length).toFixed(1)} avg rating
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="space-y-4">
        {/* Domain Filters */}
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <Button
              key={domain}
              variant={selectedDomain === domain ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDomain(domain)}
              className="text-xs"
            >
              {domain}
            </Button>
          ))}
        </div>

        {/* Search and Tier Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search agents by name, description, or expertise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            {tiers.map((tier) => (
              <Button
                key={tier}
                variant={selectedTier === tier ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTier(tier)}
                className="text-xs"
              >
                {tier}
              </Button>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {filteredAgents.length} of {agents.length} agents
        </p>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => {
          const colors = domainColors[agent.domain] || domainColors.engineering;
          const isExpanded = expandedAgent === agent.id;
          const isVisible = visibleCards.has(agent.id);

          return (
            <div
              key={agent.id}
              ref={(el) => {
                if (el) cardRefs.current.set(agent.id, el);
              }}
              data-agent-id={agent.id}
              className={`transition-all duration-500 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <Card className={`h-full flex flex-col hover:shadow-lg transition-shadow border ${colors.border}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-5xl leading-none">{agent.avatar}</span>
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <Badge className={`mt-1 text-[10px] ${colors.badge} border-0`}>
                          {agent.domain.charAt(0).toUpperCase() + agent.domain.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <Badge
                      className={`text-[10px] border ${tierColors[agent.tier]}`}
                    >
                      {agent.tier.charAt(0).toUpperCase() + agent.tier.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <CardDescription className="text-sm">
                    {agent.description}
                  </CardDescription>

                  {/* Expertise Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {agent.expertise.slice(0, 4).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] px-2 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {agent.expertise.length > 4 && (
                      <Badge variant="secondary" className="text-[10px] px-2 py-0">
                        +{agent.expertise.length - 4}
                      </Badge>
                    )}
                  </div>

                  {/* Rating */}
                  {agent.stats && (
                    <div className="flex items-center justify-between">
                      <StarRating rating={agent.stats.rating} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {agent.stats.interactions.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleChatNow(agent.id)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                      Chat Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExpandedAgent(isExpanded ? null : agent.id)
                      }
                    >
                      {isExpanded ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      <span className="ml-1">{isExpanded ? "Close" : "Details"}</span>
                    </Button>
                  </div>

                  {/* Expanded View */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div>
                        <h4 className="text-sm font-semibold mb-1.5">About</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {agent.fullDescription}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-1.5">All Expertise</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.expertise.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[10px] px-2 py-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-1.5">Sample Questions</h4>
                        <div className="space-y-1.5">
                          {agent.sampleQuestions.map((q) => (
                            <button
                              key={q}
                              onClick={() => handleSampleQuestion(agent.id, q)}
                              className="w-full text-left text-sm px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors flex items-center gap-2 group"
                            >
                              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                                {q}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {agent.stats && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1.5">Stats</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-center p-2 rounded-md bg-muted/50">
                              <div className="text-lg font-bold">{agent.stats.interactions.toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground">Interactions</div>
                            </div>
                            <div className="text-center p-2 rounded-md bg-muted/50">
                              <div className="text-lg font-bold">{agent.stats.rating.toFixed(1)}</div>
                              <div className="text-[10px] text-muted-foreground">Rating</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        onClick={() => handleChatNow(agent.id)}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Start Collaboration
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredAgents.length === 0 && (
        <div className="text-center py-16">
          <p className="text-lg text-muted-foreground">No agents match your filters.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSelectedDomain("All");
              setSelectedTier("All");
              setSearchQuery("");
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
