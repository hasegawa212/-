import { Link } from "react-router-dom";
import {
  MessageSquare,
  BarChart3,
  Database,
  Bot,
  Brain,
  GitBranch,
  ArrowRight,
  Sparkles,
  Workflow,
  LayoutTemplate,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const features = [
  {
    name: "AI Chat",
    description: "Converse with AI agents powered by advanced language models",
    href: "/chat",
    icon: MessageSquare,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    name: "Analytics",
    description: "Track usage, performance metrics, and conversation insights",
    href: "/analytics",
    icon: BarChart3,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    name: "RAG Manager",
    description: "Upload and manage documents for retrieval-augmented generation",
    href: "/rag",
    icon: Database,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    name: "Custom Agents",
    description: "Create and configure specialized AI agents for specific tasks",
    href: "/agents",
    icon: Bot,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    name: "Memory",
    description: "Manage conversational memory and contextual knowledge",
    href: "/memory",
    icon: Brain,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    name: "Workflows",
    description: "Design multi-step automated AI pipelines and workflows",
    href: "/workflows",
    icon: GitBranch,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    name: "Workflow Builder",
    description: "Visual drag-and-drop workflow editor with 34+ AI-native node types",
    href: "/workflow-builder",
    icon: Workflow,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    name: "Templates",
    description: "Pre-built workflow templates for marketing, DevOps, and AI automation",
    href: "/workflow-templates",
    icon: LayoutTemplate,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

export default function Home() {
  const { data: analytics } = trpc.analytics.summary.useQuery();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4 py-8">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Ultimate AI Agent
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          A comprehensive AI agent platform with multi-model support,
          RAG integration, custom agents, and workflow automation.
        </p>
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Start Chatting
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{analytics.totalConversations}</p>
              <p className="text-sm text-muted-foreground">Conversations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{analytics.totalMessages}</p>
              <p className="text-sm text-muted-foreground">Messages</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">
                {analytics.totalTokensUsed.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Tokens Used</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{analytics.averageResponseTime}ms</p>
              <p className="text-sm text-muted-foreground">Avg Response</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feature grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => (
          <Link key={feature.name} to={feature.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div
                  className={`h-10 w-10 rounded-lg ${feature.bg} flex items-center justify-center mb-2`}
                >
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <CardTitle className="text-lg">{feature.name}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
