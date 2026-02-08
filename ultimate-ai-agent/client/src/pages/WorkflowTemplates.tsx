import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  Users,
  Rss,
  Database,
  Mail,
  Code,
  Languages,
  Heart,
  Mic,
  Bug,
  Newspaper,
  Activity,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodeCount: number;
  icon: React.ReactNode;
}

// ─── Category definitions ────────────────────────────────────────────────────

const CATEGORIES = [
  "All",
  "Marketing",
  "DevOps",
  "Data Processing",
  "AI Automation",
  "Customer Support",
  "Content Creation",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Marketing: "bg-pink-500/15 text-pink-500 border-pink-500/30",
  DevOps: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  "Data Processing": "bg-orange-500/15 text-orange-500 border-orange-500/30",
  "AI Automation": "bg-purple-500/15 text-purple-500 border-purple-500/30",
  "Customer Support": "bg-green-500/15 text-green-500 border-green-500/30",
  "Content Creation": "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
};

// ─── Template data ───────────────────────────────────────────────────────────

const TEMPLATES: WorkflowTemplate[] = [
  {
    id: "content-pipeline",
    name: "Content Pipeline",
    description:
      "Automated blog generation pipeline with AI-powered writing, editing, and review stages. Includes SEO optimization and quality checks.",
    category: "Content Creation",
    nodeCount: 6,
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: "lead-scorer",
    name: "Lead Scorer",
    description:
      "Score incoming leads using AI classification based on behavioral data, demographics, and engagement patterns. Routes high-value leads automatically.",
    category: "Marketing",
    nodeCount: 5,
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: "slack-alerts",
    name: "Slack Alerts",
    description:
      "Monitor multiple RSS feeds and news sources, filter relevant items with AI, and post formatted alerts to designated Slack channels.",
    category: "DevOps",
    nodeCount: 4,
    icon: <Rss className="h-5 w-5" />,
  },
  {
    id: "data-etl",
    name: "Data ETL",
    description:
      "Extract data from multiple sources, apply transformations and validations, then load into your data warehouse. Supports CSV, JSON, and API sources.",
    category: "Data Processing",
    nodeCount: 7,
    icon: <Database className="h-5 w-5" />,
  },
  {
    id: "email-responder",
    name: "Email Responder",
    description:
      "Automatically classify incoming emails by intent and urgency, draft context-aware responses, and route complex cases to the right team.",
    category: "Customer Support",
    nodeCount: 5,
    icon: <Mail className="h-5 w-5" />,
  },
  {
    id: "code-review-bot",
    name: "Code Review Bot",
    description:
      "Analyze pull requests with AI to detect bugs, security issues, and style violations. Posts inline review comments and approval recommendations.",
    category: "DevOps",
    nodeCount: 6,
    icon: <Code className="h-5 w-5" />,
  },
  {
    id: "translation-pipeline",
    name: "Translation Pipeline",
    description:
      "Translate content into multiple languages using AI with context-aware translation, glossary support, and quality verification steps.",
    category: "Content Creation",
    nodeCount: 5,
    icon: <Languages className="h-5 w-5" />,
  },
  {
    id: "sentiment-monitor",
    name: "Sentiment Monitor",
    description:
      "Track brand sentiment across social media feeds and review sites. Aggregate scores, detect trends, and alert on negative spikes.",
    category: "Marketing",
    nodeCount: 6,
    icon: <Heart className="h-5 w-5" />,
  },
  {
    id: "meeting-summarizer",
    name: "Meeting Summarizer",
    description:
      "Process meeting transcripts to extract key decisions, action items, and summaries. Distributes notes to attendees automatically.",
    category: "AI Automation",
    nodeCount: 4,
    icon: <Mic className="h-5 w-5" />,
  },
  {
    id: "bug-triager",
    name: "Bug Triager",
    description:
      "Automatically classify incoming bug reports by severity and component, detect duplicates, and route to the appropriate engineering team.",
    category: "DevOps",
    nodeCount: 5,
    icon: <Bug className="h-5 w-5" />,
  },
  {
    id: "newsletter-generator",
    name: "Newsletter Generator",
    description:
      "Curate content from multiple sources, generate editorial summaries with AI, compose a formatted newsletter, and schedule distribution.",
    category: "Content Creation",
    nodeCount: 7,
    icon: <Newspaper className="h-5 w-5" />,
  },
  {
    id: "api-health-monitor",
    name: "API Health Monitor",
    description:
      "Periodically check API endpoint health, measure response times, detect anomalies, and send alerts when services degrade or go down.",
    category: "DevOps",
    nodeCount: 5,
    icon: <Activity className="h-5 w-5" />,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkflowTemplates() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const handleUseTemplate = (templateId: string) => {
    navigate(`/workflow-builder?template=${templateId}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold">Workflow Templates</h2>
        <p className="text-muted-foreground">
          Start with a pre-built template and customize it for your needs
        </p>
      </div>

      {/* ── Search and Filters ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="shrink-0 text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Template Grid ───────────────────────────────────────────────── */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            No templates match your search. Try a different query or category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="flex flex-col hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {template.icon}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      CATEGORY_COLORS[template.category] ?? ""
                    }`}
                  >
                    {template.category}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2">{template.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-3">
                  {template.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pb-3 mt-auto">
                <span className="text-xs text-muted-foreground">
                  {template.nodeCount} nodes
                </span>
              </CardContent>

              <CardFooter className="pt-0">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleUseTemplate(template.id)}
                >
                  Use Template
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
