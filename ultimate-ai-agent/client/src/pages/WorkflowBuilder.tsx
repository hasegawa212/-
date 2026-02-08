import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Play,
  Save,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Sparkles,
  PanelLeftClose,
  PanelRightClose,
  ChevronDown,
  ChevronUp,
  X,
  GripVertical,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
  icon: string;
  category: string;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface ExecutionResult {
  status: "completed" | "failed" | "partial";
  duration: number;
  nodeResults: Array<{
    nodeId: string;
    status: "success" | "error" | "skipped";
    output: string;
    duration: number;
  }>;
}

interface HistoryState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ─── Palette node definitions ────────────────────────────────────────────────

const PALETTE_NODES = [
  { type: "trigger", label: "Trigger", icon: "zap", category: "Control" },
  { type: "llm", label: "LLM Call", icon: "brain", category: "AI" },
  { type: "prompt", label: "Prompt Template", icon: "file-text", category: "AI" },
  { type: "classifier", label: "Classifier", icon: "tag", category: "AI" },
  { type: "http", label: "HTTP Request", icon: "globe", category: "Integration" },
  { type: "webhook", label: "Webhook", icon: "link", category: "Integration" },
  { type: "email", label: "Send Email", icon: "mail", category: "Integration" },
  { type: "slack", label: "Slack Message", icon: "message-square", category: "Integration" },
  { type: "condition", label: "Condition", icon: "git-branch", category: "Control" },
  { type: "loop", label: "Loop", icon: "repeat", category: "Control" },
  { type: "delay", label: "Delay", icon: "clock", category: "Control" },
  { type: "transform", label: "Transform Data", icon: "shuffle", category: "Data" },
  { type: "filter", label: "Filter", icon: "filter", category: "Data" },
  { type: "database", label: "Database Query", icon: "database", category: "Data" },
  { type: "output", label: "Output", icon: "check-circle", category: "Control" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Control: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  AI: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Integration: "bg-green-500/20 text-green-400 border-green-500/30",
  Data: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const NODE_COLORS: Record<string, string> = {
  Control: "#3b82f6",
  AI: "#a855f7",
  Integration: "#22c55e",
  Data: "#f97316",
};

// ─── Helper: unique ID ───────────────────────────────────────────────────────

let idCounter = 0;
function uid(prefix = "node") {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkflowBuilder() {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template");

  // Core state
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");

  // UI state
  const [showPalette, setShowPalette] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  const [showExecution, setShowExecution] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Undo / Redo
  const [history, setHistory] = useState<HistoryState[]>([{ nodes: [], edges: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Edge drawing
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Panning
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // ─── History helpers ─────────────────────────────────────────────────────

  const pushHistory = useCallback(
    (newNodes: WorkflowNode[], newEdges: WorkflowEdge[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ nodes: newNodes, edges: newEdges });
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    },
    [history, historyIndex]
  );

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setHistoryIndex(historyIndex - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setNodes(next.nodes);
    setEdges(next.edges);
    setHistoryIndex(historyIndex + 1);
  }, [history, historyIndex]);

  // ─── Node operations ────────────────────────────────────────────────────

  const addNode = useCallback(
    (type: string, x: number, y: number) => {
      const palette = PALETTE_NODES.find((p) => p.type === type);
      if (!palette) return;
      const newNode: WorkflowNode = {
        id: uid("node"),
        type,
        label: palette.label,
        x,
        y,
        config: {},
        icon: palette.icon,
        category: palette.category,
      };
      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      pushHistory(newNodes, edges);
      setSelectedNodeId(newNode.id);
    },
    [nodes, edges, pushHistory]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const newNodes = nodes.filter((n) => n.id !== nodeId);
      const newEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
      setNodes(newNodes);
      setEdges(newEdges);
      pushHistory(newNodes, newEdges);
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [nodes, edges, selectedNodeId, pushHistory]
  );

  const connectNodes = useCallback(
    (source: string, target: string) => {
      if (source === target) return;
      if (edges.some((e) => e.source === source && e.target === target)) return;
      const newEdge: WorkflowEdge = { id: uid("edge"), source, target };
      const newEdges = [...edges, newEdge];
      setEdges(newEdges);
      pushHistory(nodes, newEdges);
    },
    [nodes, edges, pushHistory]
  );

  // ─── Canvas coordinate helpers ──────────────────────────────────────────

  const clientToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - panOffset.x) / zoom,
        y: (clientY - rect.top - panOffset.y) / zoom,
      };
    },
    [zoom, panOffset]
  );

  // ─── Drag & drop from palette ───────────────────────────────────────────

  const handlePaletteDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData("nodeType", type);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("nodeType");
    if (!type) return;
    const pos = clientToCanvas(e.clientX, e.clientY);
    addNode(type, pos.x - 70, pos.y - 25);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // ─── Node drag on canvas ────────────────────────────────────────────────

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const pos = clientToCanvas(e.clientX, e.clientY);
    setDraggingNodeId(nodeId);
    setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
    setSelectedNodeId(nodeId);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const pos = clientToCanvas(e.clientX, e.clientY);
    setMousePos(pos);

    if (draggingNodeId) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNodeId
            ? { ...n, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
            : n
        )
      );
    }

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggingNodeId) {
      pushHistory(nodes, edges);
      setDraggingNodeId(null);
    }
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === "rect") {
      setSelectedNodeId(null);
      if (e.button === 0) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  // ─── Connection handles ────────────────────────────────────────────────

  const handleOutputClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setConnectingFrom(nodeId);
  };

  const handleInputClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom !== nodeId) {
      connectNodes(connectingFrom, nodeId);
    }
    setConnectingFrom(null);
  };

  // ─── Zoom ──────────────────────────────────────────────────────────────

  const zoomIn = () => setZoom((z) => Math.min(z + 0.1, 2));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.3));

  // ─── Save & Run ────────────────────────────────────────────────────────

  const handleSave = async () => {
    const payload = {
      name: workflowName,
      nodes,
      edges,
    };
    console.log("Saving workflow:", payload);
    // POST to /api/trpc/workflows.create
    // For now, just console.log
  };

  const handleRun = async () => {
    setIsRunning(true);
    setShowExecution(true);
    setExecutionResult(null);

    try {
      const response = await fetch("/api/workflow/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });
      const result = await response.json();
      setExecutionResult(result);
    } catch {
      setExecutionResult({
        status: "failed",
        duration: 0,
        nodeResults: [
          {
            nodeId: "error",
            status: "error",
            output: "Failed to execute workflow. API may be unavailable.",
            duration: 0,
          },
        ],
      });
    } finally {
      setIsRunning(false);
    }
  };

  // ─── AI Generate ───────────────────────────────────────────────────────

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch("/api/workflow/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
      });
      const result = await response.json();
      if (result.nodes && result.edges) {
        setNodes(result.nodes);
        setEdges(result.edges);
        if (result.name) setWorkflowName(result.name);
        pushHistory(result.nodes, result.edges);
      }
      setShowAIModal(false);
      setAiPrompt("");
    } catch {
      console.error("AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Config panel update ───────────────────────────────────────────────

  const updateNodeConfig = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    const newNodes = nodes.map((n) =>
      n.id === selectedNodeId ? { ...n, config: { ...n.config, [key]: value } } : n
    );
    setNodes(newNodes);
  };

  const updateNodeLabel = (label: string) => {
    if (!selectedNodeId) return;
    const newNodes = nodes.map((n) =>
      n.id === selectedNodeId ? { ...n, label } : n
    );
    setNodes(newNodes);
  };

  // ─── Load template on mount if query param ─────────────────────────────

  useEffect(() => {
    if (templateId) {
      console.log("Loading template:", templateId);
      // In a real app, fetch template data and load it
    }
  }, [templateId]);

  // ─── Edge path helper ──────────────────────────────────────────────────

  const getEdgePath = (source: WorkflowNode, target: WorkflowNode) => {
    const sx = source.x + 140;
    const sy = source.y + 25;
    const tx = target.x;
    const ty = target.y + 25;
    const cx = (sx + tx) / 2;
    return `M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`;
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setShowPalette(!showPalette)}
          title="Toggle palette"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>

        <Input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="w-48 h-8 text-sm font-medium bg-transparent border-transparent hover:border-input focus:border-input"
        />

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} title="Undo">
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        <Button variant="ghost" size="sm" onClick={zoomOut} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="sm" onClick={zoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAIModal(true)}
          className="gap-1.5"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">AI Generate</span>
        </Button>

        <Button variant="outline" size="sm" onClick={handleSave} className="gap-1.5">
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">Save</span>
        </Button>

        <Button
          size="sm"
          onClick={handleRun}
          disabled={isRunning || nodes.length === 0}
          className="gap-1.5"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{isRunning ? "Running..." : "Run"}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setShowConfig(!showConfig)}
          title="Toggle config"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Main body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Node Palette (left) ──────────────────────────────────────── */}
        <aside
          className={`${
            showPalette ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"
          } fixed lg:relative inset-y-0 left-0 z-30 w-56 bg-card border-r transition-transform duration-200 lg:transition-all overflow-y-auto shrink-0`}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Nodes
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 lg:hidden"
                onClick={() => setShowPalette(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {Object.entries(
              PALETTE_NODES.reduce<Record<string, typeof PALETTE_NODES>>((acc, node) => {
                (acc[node.category] ??= []).push(node);
                return acc;
              }, {})
            ).map(([category, catNodes]) => (
              <div key={category} className="mb-4">
                <Badge
                  variant="outline"
                  className={`mb-2 text-[10px] ${CATEGORY_COLORS[category] ?? ""}`}
                >
                  {category}
                </Badge>
                <div className="space-y-1">
                  {catNodes.map((node) => (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={(e) => handlePaletteDragStart(e, node.type)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-grab hover:bg-accent active:cursor-grabbing transition-colors"
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                      <span>{node.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {showPalette && (
          <div
            className="fixed inset-0 bg-black/30 z-20 lg:hidden"
            onClick={() => setShowPalette(false)}
          />
        )}

        {/* ── Canvas (center) ──────────────────────────────────────────── */}
        <div
          className="flex-1 relative overflow-hidden bg-muted/30"
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          {nodes.length === 0 && !isRunning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <div className="text-center space-y-3 px-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Drag nodes from the palette to build your workflow
                </p>
                <p className="text-muted-foreground/70 text-xs">or</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="pointer-events-auto gap-1.5"
                  onClick={() => setShowAIModal(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  Use AI to generate a workflow
                </Button>
              </div>
            </div>
          )}

          <svg
            ref={svgRef}
            className="w-full h-full"
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseDown={handleCanvasMouseDown}
            onMouseLeave={() => {
              setDraggingNodeId(null);
              setIsPanning(false);
            }}
          >
            {/* Grid pattern */}
            <defs>
              <pattern
                id="grid"
                width={20 * zoom}
                height={20 * zoom}
                patternUnits="userSpaceOnUse"
                x={panOffset.x % (20 * zoom)}
                y={panOffset.y % (20 * zoom)}
              >
                <circle cx={1} cy={1} r={0.5} fill="currentColor" className="text-muted-foreground/20" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
              {/* Edges */}
              {edges.map((edge) => {
                const source = nodes.find((n) => n.id === edge.source);
                const target = nodes.find((n) => n.id === edge.target);
                if (!source || !target) return null;
                return (
                  <path
                    key={edge.id}
                    d={getEdgePath(source, target)}
                    stroke="currentColor"
                    className="text-muted-foreground/40"
                    strokeWidth={2}
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}

              {/* Connection line being drawn */}
              {connectingFrom && (() => {
                const sourceNode = nodes.find((n) => n.id === connectingFrom);
                if (!sourceNode) return null;
                return (
                  <line
                    x1={sourceNode.x + 140}
                    y1={sourceNode.y + 25}
                    x2={mousePos.x}
                    y2={mousePos.y}
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                  />
                );
              })()}

              {/* Arrow marker */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth={10}
                  markerHeight={7}
                  refX={9}
                  refY={3.5}
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="currentColor"
                    className="text-muted-foreground/40"
                  />
                </marker>
              </defs>

              {/* Nodes */}
              {nodes.map((node) => {
                const color = NODE_COLORS[node.category] ?? "#888";
                const isSelected = node.id === selectedNodeId;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    className="cursor-pointer"
                  >
                    {/* Node body */}
                    <rect
                      width={140}
                      height={50}
                      rx={8}
                      fill="var(--card)"
                      stroke={isSelected ? color : "var(--border)"}
                      strokeWidth={isSelected ? 2 : 1}
                      className="drop-shadow-sm"
                    />
                    {/* Color bar */}
                    <rect width={4} height={50} rx={2} fill={color} />
                    {/* Label */}
                    <text
                      x={16}
                      y={22}
                      fontSize={12}
                      fontWeight={500}
                      fill="currentColor"
                      className="text-foreground select-none"
                    >
                      {node.label}
                    </text>
                    <text
                      x={16}
                      y={38}
                      fontSize={10}
                      fill="currentColor"
                      className="text-muted-foreground select-none"
                    >
                      {node.type}
                    </text>

                    {/* Input handle (left) */}
                    <circle
                      cx={0}
                      cy={25}
                      r={5}
                      fill="var(--card)"
                      stroke={color}
                      strokeWidth={1.5}
                      className="cursor-crosshair hover:fill-current"
                      onClick={(e) => handleInputClick(e, node.id)}
                    />

                    {/* Output handle (right) */}
                    <circle
                      cx={140}
                      cy={25}
                      r={5}
                      fill="var(--card)"
                      stroke={color}
                      strokeWidth={1.5}
                      className="cursor-crosshair hover:fill-current"
                      onClick={(e) => handleOutputClick(e, node.id)}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* ── Node Config Panel (right) ────────────────────────────────── */}
        <aside
          className={`${
            showConfig ? "translate-x-0" : "translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"
          } fixed lg:relative inset-y-0 right-0 z-30 w-64 bg-card border-l transition-transform duration-200 lg:transition-all overflow-y-auto shrink-0`}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Configuration
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 lg:hidden"
                onClick={() => setShowConfig(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Label
                  </label>
                  <Input
                    value={selectedNode.label}
                    onChange={(e) => updateNodeLabel(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Type
                  </label>
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[selectedNode.category] ?? ""}
                  >
                    {selectedNode.type}
                  </Badge>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Category
                  </label>
                  <span className="text-sm">{selectedNode.category}</span>
                </div>

                {/* Dynamic config fields based on node type */}
                {selectedNode.type === "llm" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Model
                      </label>
                      <Input
                        value={(selectedNode.config.model as string) ?? "gpt-4o-mini"}
                        onChange={(e) => updateNodeConfig("model", e.target.value)}
                        className="h-8 text-sm"
                        placeholder="gpt-4o-mini"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Temperature
                      </label>
                      <Input
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={(selectedNode.config.temperature as number) ?? 0.7}
                        onChange={(e) => updateNodeConfig("temperature", parseFloat(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </>
                )}

                {selectedNode.type === "http" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        URL
                      </label>
                      <Input
                        value={(selectedNode.config.url as string) ?? ""}
                        onChange={(e) => updateNodeConfig("url", e.target.value)}
                        className="h-8 text-sm"
                        placeholder="https://api.example.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Method
                      </label>
                      <select
                        value={(selectedNode.config.method as string) ?? "GET"}
                        onChange={(e) => updateNodeConfig("method", e.target.value)}
                        className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                      >
                        <option>GET</option>
                        <option>POST</option>
                        <option>PUT</option>
                        <option>DELETE</option>
                      </select>
                    </div>
                  </>
                )}

                {selectedNode.type === "condition" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Expression
                    </label>
                    <Input
                      value={(selectedNode.config.expression as string) ?? ""}
                      onChange={(e) => updateNodeConfig("expression", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="value > 10"
                    />
                  </div>
                )}

                {selectedNode.type === "delay" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Delay (ms)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={(selectedNode.config.delay as number) ?? 1000}
                      onChange={(e) => updateNodeConfig("delay", parseInt(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                )}

                {selectedNode.type === "email" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        To
                      </label>
                      <Input
                        value={(selectedNode.config.to as string) ?? ""}
                        onChange={(e) => updateNodeConfig("to", e.target.value)}
                        className="h-8 text-sm"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Subject
                      </label>
                      <Input
                        value={(selectedNode.config.subject as string) ?? ""}
                        onChange={(e) => updateNodeConfig("subject", e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Subject line"
                      />
                    </div>
                  </>
                )}

                {selectedNode.type === "prompt" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Prompt Template
                    </label>
                    <textarea
                      value={(selectedNode.config.template as string) ?? ""}
                      onChange={(e) => updateNodeConfig("template", e.target.value)}
                      className="w-full min-h-[80px] text-sm rounded-md border border-input bg-background px-3 py-2 resize-y"
                      placeholder="You are a helpful assistant. {{input}}"
                    />
                  </div>
                )}

                {selectedNode.type === "database" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Query
                    </label>
                    <textarea
                      value={(selectedNode.config.query as string) ?? ""}
                      onChange={(e) => updateNodeConfig("query", e.target.value)}
                      className="w-full min-h-[80px] text-sm rounded-md border border-input bg-background px-3 py-2 resize-y font-mono"
                      placeholder="SELECT * FROM ..."
                    />
                  </div>
                )}

                <div className="pt-2 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => deleteNode(selectedNode.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete Node
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a node on the canvas to configure it.
              </p>
            )}
          </div>
        </aside>

        {showConfig && (
          <div
            className="fixed inset-0 bg-black/30 z-20 lg:hidden"
            onClick={() => setShowConfig(false)}
          />
        )}
      </div>

      {/* ── Execution Panel (bottom, collapsible) ───────────────────────── */}
      <div className="border-t bg-card shrink-0">
        <button
          onClick={() => setShowExecution(!showExecution)}
          className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            Execution Results
            {executionResult && (
              <Badge
                variant={
                  executionResult.status === "completed"
                    ? "default"
                    : executionResult.status === "failed"
                    ? "destructive"
                    : "secondary"
                }
                className="text-[10px]"
              >
                {executionResult.status}
              </Badge>
            )}
            {isRunning && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
          </span>
          {showExecution ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>

        {showExecution && (
          <div className="px-4 pb-3 max-h-48 overflow-y-auto">
            {executionResult ? (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Duration: {executionResult.duration}ms</span>
                  <span>Nodes: {executionResult.nodeResults.length}</span>
                </div>
                <div className="space-y-1">
                  {executionResult.nodeResults.map((nr, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2 rounded-md text-xs ${
                        nr.status === "success"
                          ? "bg-green-500/10"
                          : nr.status === "error"
                          ? "bg-red-500/10"
                          : "bg-yellow-500/10"
                      }`}
                    >
                      <Badge
                        variant={
                          nr.status === "success"
                            ? "default"
                            : nr.status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[10px] shrink-0"
                      >
                        {nr.status}
                      </Badge>
                      <span className="text-muted-foreground font-mono">{nr.nodeId}</span>
                      <span className="flex-1 truncate">{nr.output}</span>
                      <span className="text-muted-foreground shrink-0">{nr.duration}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : isRunning ? (
              <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing workflow...
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Run a workflow to see execution results here.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── AI Generate Modal ───────────────────────────────────────────── */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Workflow Generator
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setShowAIModal(false);
                    setAiPrompt("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Describe the workflow you want to create and AI will generate it for you.
              </p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Create a workflow that monitors RSS feeds, summarizes new articles with AI, and posts them to Slack"
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAIModal(false);
                    setAiPrompt("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="gap-1.5"
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {aiLoading ? "Generating..." : "Generate Workflow"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
