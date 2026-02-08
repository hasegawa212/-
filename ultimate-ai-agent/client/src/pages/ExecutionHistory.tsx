import { useState, useMemo } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NodeResult {
  nodeId: string;
  nodeLabel: string;
  status: "success" | "error" | "skipped";
  output: string;
  duration: number;
}

interface Execution {
  id: string;
  workflowName: string;
  status: "completed" | "failed" | "partial";
  startedAt: string;
  duration: number;
  nodesExecuted: number;
  totalNodes: number;
  nodeResults: NodeResult[];
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_EXECUTIONS: Execution[] = [
  {
    id: "exec-001",
    workflowName: "Content Pipeline",
    status: "completed",
    startedAt: "2026-02-08T09:30:00Z",
    duration: 12400,
    nodesExecuted: 6,
    totalNodes: 6,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Trigger", status: "success", output: "Triggered by schedule", duration: 50 },
      { nodeId: "n2", nodeLabel: "Fetch Sources", status: "success", output: "Retrieved 15 articles", duration: 2300 },
      { nodeId: "n3", nodeLabel: "AI Summarize", status: "success", output: "Generated 15 summaries", duration: 8200 },
      { nodeId: "n4", nodeLabel: "Format", status: "success", output: "Formatted to HTML", duration: 120 },
      { nodeId: "n5", nodeLabel: "SEO Check", status: "success", output: "Score: 92/100", duration: 430 },
      { nodeId: "n6", nodeLabel: "Publish", status: "success", output: "Published to CMS", duration: 1300 },
    ],
  },
  {
    id: "exec-002",
    workflowName: "Lead Scorer",
    status: "completed",
    startedAt: "2026-02-08T08:15:00Z",
    duration: 5600,
    nodesExecuted: 5,
    totalNodes: 5,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Webhook Trigger", status: "success", output: "Received lead data", duration: 30 },
      { nodeId: "n2", nodeLabel: "Enrich Data", status: "success", output: "Added company info", duration: 1200 },
      { nodeId: "n3", nodeLabel: "AI Classify", status: "success", output: "Score: 87 (Hot Lead)", duration: 3100 },
      { nodeId: "n4", nodeLabel: "Route", status: "success", output: "Routed to Sales Team A", duration: 80 },
      { nodeId: "n5", nodeLabel: "Notify", status: "success", output: "Slack notification sent", duration: 1190 },
    ],
  },
  {
    id: "exec-003",
    workflowName: "Email Responder",
    status: "failed",
    startedAt: "2026-02-08T07:45:00Z",
    duration: 3200,
    nodesExecuted: 3,
    totalNodes: 5,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Email Trigger", status: "success", output: "New email received", duration: 40 },
      { nodeId: "n2", nodeLabel: "Classify Intent", status: "success", output: "Category: billing inquiry", duration: 1800 },
      { nodeId: "n3", nodeLabel: "Draft Response", status: "error", output: "Error: LLM API rate limit exceeded", duration: 1360 },
      { nodeId: "n4", nodeLabel: "Review", status: "skipped", output: "Skipped due to upstream failure", duration: 0 },
      { nodeId: "n5", nodeLabel: "Send Reply", status: "skipped", output: "Skipped due to upstream failure", duration: 0 },
    ],
  },
  {
    id: "exec-004",
    workflowName: "Slack Alerts",
    status: "completed",
    startedAt: "2026-02-07T22:00:00Z",
    duration: 4100,
    nodesExecuted: 4,
    totalNodes: 4,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Schedule Trigger", status: "success", output: "Cron: every 6 hours", duration: 20 },
      { nodeId: "n2", nodeLabel: "Fetch RSS", status: "success", output: "Fetched 42 items from 3 feeds", duration: 1500 },
      { nodeId: "n3", nodeLabel: "Filter & Rank", status: "success", output: "5 items passed relevance threshold", duration: 2100 },
      { nodeId: "n4", nodeLabel: "Post to Slack", status: "success", output: "5 messages posted to #alerts", duration: 480 },
    ],
  },
  {
    id: "exec-005",
    workflowName: "Data ETL",
    status: "partial",
    startedAt: "2026-02-07T18:30:00Z",
    duration: 45200,
    nodesExecuted: 5,
    totalNodes: 7,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Trigger", status: "success", output: "Manual trigger", duration: 10 },
      { nodeId: "n2", nodeLabel: "Extract CSV", status: "success", output: "Extracted 10,000 rows", duration: 3200 },
      { nodeId: "n3", nodeLabel: "Extract API", status: "success", output: "Fetched 2,500 records", duration: 8400 },
      { nodeId: "n4", nodeLabel: "Transform", status: "success", output: "Merged and cleaned 12,500 records", duration: 15000 },
      { nodeId: "n5", nodeLabel: "Validate", status: "success", output: "98.2% valid, 225 rejected", duration: 6200 },
      { nodeId: "n6", nodeLabel: "Load to Warehouse", status: "error", output: "Connection timeout after 12s", duration: 12390 },
      { nodeId: "n7", nodeLabel: "Send Report", status: "skipped", output: "Skipped due to upstream failure", duration: 0 },
    ],
  },
  {
    id: "exec-006",
    workflowName: "Code Review Bot",
    status: "completed",
    startedAt: "2026-02-07T16:20:00Z",
    duration: 18700,
    nodesExecuted: 6,
    totalNodes: 6,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "PR Webhook", status: "success", output: "PR #247 opened", duration: 25 },
      { nodeId: "n2", nodeLabel: "Fetch Diff", status: "success", output: "Retrieved 14 changed files", duration: 800 },
      { nodeId: "n3", nodeLabel: "Static Analysis", status: "success", output: "2 warnings, 0 errors", duration: 3200 },
      { nodeId: "n4", nodeLabel: "AI Review", status: "success", output: "Generated 5 inline comments", duration: 12000 },
      { nodeId: "n5", nodeLabel: "Security Scan", status: "success", output: "No vulnerabilities found", duration: 1800 },
      { nodeId: "n6", nodeLabel: "Post Comments", status: "success", output: "Posted review to GitHub", duration: 875 },
    ],
  },
  {
    id: "exec-007",
    workflowName: "Sentiment Monitor",
    status: "completed",
    startedAt: "2026-02-07T12:00:00Z",
    duration: 9800,
    nodesExecuted: 6,
    totalNodes: 6,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Schedule", status: "success", output: "Hourly check", duration: 15 },
      { nodeId: "n2", nodeLabel: "Scrape Social", status: "success", output: "Collected 340 mentions", duration: 4200 },
      { nodeId: "n3", nodeLabel: "Analyze Sentiment", status: "success", output: "Avg score: 0.72 (positive)", duration: 3800 },
      { nodeId: "n4", nodeLabel: "Detect Anomalies", status: "success", output: "No anomalies detected", duration: 500 },
      { nodeId: "n5", nodeLabel: "Store Results", status: "success", output: "Saved to dashboard DB", duration: 320 },
      { nodeId: "n6", nodeLabel: "Update Dashboard", status: "success", output: "Dashboard refreshed", duration: 965 },
    ],
  },
  {
    id: "exec-008",
    workflowName: "Meeting Summarizer",
    status: "failed",
    startedAt: "2026-02-07T10:30:00Z",
    duration: 1200,
    nodesExecuted: 1,
    totalNodes: 4,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Transcript Upload", status: "error", output: "Error: File format not supported (.wav)", duration: 1200 },
      { nodeId: "n2", nodeLabel: "Transcribe", status: "skipped", output: "Skipped", duration: 0 },
      { nodeId: "n3", nodeLabel: "Summarize", status: "skipped", output: "Skipped", duration: 0 },
      { nodeId: "n4", nodeLabel: "Distribute", status: "skipped", output: "Skipped", duration: 0 },
    ],
  },
  {
    id: "exec-009",
    workflowName: "Bug Triager",
    status: "completed",
    startedAt: "2026-02-06T14:50:00Z",
    duration: 7300,
    nodesExecuted: 5,
    totalNodes: 5,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Issue Webhook", status: "success", output: "New issue #1042", duration: 20 },
      { nodeId: "n2", nodeLabel: "Parse Issue", status: "success", output: "Extracted title, body, labels", duration: 150 },
      { nodeId: "n3", nodeLabel: "Classify", status: "success", output: "Severity: High, Component: Auth", duration: 4200 },
      { nodeId: "n4", nodeLabel: "Check Duplicates", status: "success", output: "No duplicates found", duration: 1800 },
      { nodeId: "n5", nodeLabel: "Assign & Label", status: "success", output: "Assigned to @backend-team", duration: 1130 },
    ],
  },
  {
    id: "exec-010",
    workflowName: "API Health Monitor",
    status: "partial",
    startedAt: "2026-02-06T06:00:00Z",
    duration: 15600,
    nodesExecuted: 4,
    totalNodes: 5,
    nodeResults: [
      { nodeId: "n1", nodeLabel: "Schedule", status: "success", output: "Every 5 minutes", duration: 10 },
      { nodeId: "n2", nodeLabel: "Ping Endpoints", status: "success", output: "8/10 endpoints healthy", duration: 12000 },
      { nodeId: "n3", nodeLabel: "Analyze Latency", status: "success", output: "Avg latency: 245ms, P99: 1.2s", duration: 800 },
      { nodeId: "n4", nodeLabel: "Alert", status: "success", output: "Alert sent for 2 degraded endpoints", duration: 2790 },
      { nodeId: "n5", nodeLabel: "Log to DB", status: "error", output: "Database write timeout", duration: 0 },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = (seconds % 60).toFixed(0);
  return `${minutes}m ${remaining}s`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS_CONFIG = {
  completed: {
    label: "Completed",
    className: "bg-green-500/15 text-green-500 border-green-500/30",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/15 text-red-500 border-red-500/30",
    icon: XCircle,
  },
  partial: {
    label: "Partial",
    className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    icon: AlertTriangle,
  },
} as const;

const NODE_STATUS_COLORS = {
  success: "bg-green-500/15 text-green-500 border-green-500/30",
  error: "bg-red-500/15 text-red-500 border-red-500/30",
  skipped: "bg-muted text-muted-foreground border-border",
} as const;

const ITEMS_PER_PAGE = 20;

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExecutionHistory() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter executions
  const filteredExecutions = useMemo(() => {
    return MOCK_EXECUTIONS.filter((exec) => {
      if (statusFilter !== "all" && exec.status !== statusFilter) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(exec.startedAt) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(exec.startedAt) > to) return false;
      }
      return true;
    });
  }, [statusFilter, dateFrom, dateTo]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredExecutions.length / ITEMS_PER_PAGE));
  const paginatedExecutions = filteredExecutions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate a refresh delay
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Execution History</h2>
          <p className="text-muted-foreground">
            View past workflow executions and their results
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {["all", "completed", "failed", "partial"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className="text-xs capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 w-36 text-xs"
              placeholder="From"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 w-36 text-xs"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* ── Execution Table ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            {filteredExecutions.length} execution{filteredExecutions.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-[2rem_1fr_7rem_8rem_5rem_6rem_5rem] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
            <span />
            <span>Workflow Name</span>
            <span>Status</span>
            <span>Started</span>
            <span>Duration</span>
            <span>Nodes</span>
            <span>Actions</span>
          </div>

          {paginatedExecutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                No executions match the current filters.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {paginatedExecutions.map((exec) => {
                const config = STATUS_CONFIG[exec.status];
                const StatusIcon = config.icon;
                const isExpanded = expandedId === exec.id;

                return (
                  <div key={exec.id}>
                    {/* Row */}
                    <div
                      className="grid grid-cols-1 sm:grid-cols-[2rem_1fr_7rem_8rem_5rem_6rem_5rem] gap-3 px-4 py-3 items-center hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(exec.id)}
                    >
                      <span className="hidden sm:flex items-center">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </span>

                      <div className="flex items-center gap-2 sm:gap-0">
                        <StatusIcon className="h-4 w-4 sm:hidden shrink-0" style={{ color: exec.status === "completed" ? "#22c55e" : exec.status === "failed" ? "#ef4444" : "#eab308" }} />
                        <span className="font-medium text-sm">{exec.workflowName}</span>
                      </div>

                      <div className="hidden sm:block">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${config.className}`}
                        >
                          {config.label}
                        </Badge>
                      </div>

                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {formatDateTime(exec.startedAt)}
                      </span>

                      <span className="text-xs text-muted-foreground hidden sm:block tabular-nums">
                        {formatDuration(exec.duration)}
                      </span>

                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {exec.nodesExecuted}/{exec.totalNodes}
                      </span>

                      <div className="hidden sm:block">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(exec.id);
                          }}
                        >
                          {isExpanded ? "Hide" : "Details"}
                        </Button>
                      </div>

                      {/* Mobile meta row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground sm:hidden col-span-full">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${config.className}`}
                        >
                          {config.label}
                        </Badge>
                        <span>{formatDateTime(exec.startedAt)}</span>
                        <span>{formatDuration(exec.duration)}</span>
                        <span>
                          {exec.nodesExecuted}/{exec.totalNodes} nodes
                        </span>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 sm:pl-12 bg-muted/10">
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-medium text-muted-foreground mb-2">
                            Node-by-Node Results
                          </h4>
                          {exec.nodeResults.map((nr, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-2 rounded-md bg-card text-xs"
                            >
                              <Badge
                                variant="outline"
                                className={`text-[10px] shrink-0 ${
                                  NODE_STATUS_COLORS[nr.status]
                                }`}
                              >
                                {nr.status}
                              </Badge>
                              <span className="font-medium w-28 shrink-0 truncate">
                                {nr.nodeLabel}
                              </span>
                              <span className="flex-1 text-muted-foreground truncate">
                                {nr.output}
                              </span>
                              <span className="text-muted-foreground shrink-0 tabular-nums">
                                {nr.duration > 0 ? formatDuration(nr.duration) : "--"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="h-7 text-xs gap-1"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="h-7 text-xs gap-1"
                >
                  Next
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
