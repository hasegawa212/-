import { useState, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  Upload,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  FileText,
  Table2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileJson,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface BatchItem {
  id: number;
  input: string;
  output: string;
  status: "pending" | "processing" | "success" | "error";
  time: number;
  error?: string;
}

interface BatchSummary {
  total: number;
  success: number;
  errors: number;
  avgResponseTime: number;
  totalTokens: number;
}

const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const EXAMPLE_TEMPLATES = [
  {
    name: "Translate batch",
    template: "Translate the following text to Japanese: {{item}}",
    description: "Translate items to a target language",
  },
  {
    name: "Classify batch",
    template: "Classify the following text into one of these categories: [Positive, Negative, Neutral]. Text: {{item}}. Return ONLY the category.",
    description: "Classify items into categories",
  },
  {
    name: "Extract emails",
    template: "Extract all email addresses from the following text. Return only the email addresses, one per line: {{item}}",
    description: "Extract email addresses from text",
  },
  {
    name: "Summarize batch",
    template: "Summarize the following text in one sentence: {{item}}",
    description: "Summarize each item concisely",
  },
  {
    name: "Generate titles",
    template: "Generate a compelling, SEO-friendly title for the following content. Return ONLY the title: {{item}}",
    description: "Generate titles for content items",
  },
];

export default function BatchProcessor() {
  const [inputMode, setInputMode] = useState<"text" | "csv" | "json">("text");
  const [rawInput, setRawInput] = useState("");
  const [parsedItems, setParsedItems] = useState<string[]>([]);
  const [template, setTemplate] = useState("Translate the following text to Japanese: {{item}}");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.7);
  const [concurrency, setConcurrency] = useState(3);

  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseInput = useCallback(
    (text: string, mode: string) => {
      let items: string[] = [];
      if (mode === "json") {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            items = parsed.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
          }
        } catch {
          setError("Invalid JSON array format");
          return;
        }
      } else if (mode === "csv") {
        items = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        // Skip header row if it looks like one
        if (items.length > 1 && items[0].includes(",")) {
          items = items.slice(1);
        }
      } else {
        items = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
      }

      setParsedItems(items);
      setError(null);
    },
    []
  );

  const handleInputChange = (text: string) => {
    setRawInput(text);
    parseInput(text, inputMode);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const mode = file.name.endsWith(".json") ? "json" : file.name.endsWith(".csv") ? "csv" : "text";
    setInputMode(mode);
    setRawInput(text);
    parseInput(text, mode);
    e.target.value = "";
  };

  const processItem = async (item: string): Promise<{ output: string; time: number }> => {
    const prompt = template.replace(/\{\{item\}\}/g, item);
    const startTime = Date.now();

    const res = await fetch("/api/playground/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: "You are a helpful assistant. Follow the instructions precisely and be concise." },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const output = data.choices?.[0]?.message?.content || data.content || "";
    const time = Date.now() - startTime;

    return { output, time };
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const startProcessing = async () => {
    if (parsedItems.length === 0) {
      setError("No items to process. Add input data first.");
      return;
    }

    cancelRef.current = false;
    pauseRef.current = false;
    setProcessing(true);
    setPaused(false);
    setError(null);
    setSummary(null);

    const items: BatchItem[] = parsedItems.map((input, i) => ({
      id: i,
      input,
      output: "",
      status: "pending",
      time: 0,
    }));
    setBatchItems(items);

    let completed = 0;
    let errors = 0;
    let totalTime = 0;

    // Process in batches of concurrency
    for (let i = 0; i < items.length; i += concurrency) {
      if (cancelRef.current) break;

      while (pauseRef.current) {
        await sleep(500);
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      const batch = items.slice(i, i + concurrency);
      const batchPromises = batch.map(async (item) => {
        setBatchItems((prev) =>
          prev.map((bi) => (bi.id === item.id ? { ...bi, status: "processing" } : bi))
        );

        try {
          const result = await processItem(item.input);
          completed++;
          totalTime += result.time;
          setBatchItems((prev) =>
            prev.map((bi) =>
              bi.id === item.id
                ? { ...bi, output: result.output, status: "success", time: result.time }
                : bi
            )
          );
        } catch (err) {
          errors++;
          setBatchItems((prev) =>
            prev.map((bi) =>
              bi.id === item.id
                ? {
                    ...bi,
                    output: "",
                    status: "error",
                    error: err instanceof Error ? err.message : "Failed",
                  }
                : bi
            )
          );
        }
      });

      await Promise.all(batchPromises);
    }

    setProcessing(false);
    setSummary({
      total: items.length,
      success: completed,
      errors,
      avgResponseTime: completed > 0 ? Math.round(totalTime / completed) : 0,
      totalTokens: 0,
    });
  };

  const handlePause = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(!paused);
  };

  const handleCancel = () => {
    cancelRef.current = true;
    pauseRef.current = false;
    setPaused(false);
  };

  const completedCount = batchItems.filter(
    (i) => i.status === "success" || i.status === "error"
  ).length;
  const progressPct = batchItems.length > 0 ? (completedCount / batchItems.length) * 100 : 0;
  const remainingItems = batchItems.filter((i) => i.status === "pending" || i.status === "processing").length;
  const avgTime = completedCount > 0
    ? batchItems.filter((i) => i.status === "success").reduce((sum, i) => sum + i.time, 0) / completedCount
    : 0;
  const estimatedRemaining = remainingItems > 0 ? Math.round((avgTime * remainingItems) / concurrency / 1000) : 0;

  const exportCSV = () => {
    const header = "Input,Output,Status,Time (ms)\n";
    const rows = batchItems
      .map(
        (item) =>
          `"${item.input.replace(/"/g, '""')}","${item.output.replace(/"/g, '""')}",${item.status},${item.time}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const data = batchItems.map((item) => ({
      input: item.input,
      output: item.output,
      status: item.status,
      time: item.time,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch-results.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(batchItems.length / itemsPerPage));
  const paginatedItems = batchItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const loadTemplate = (tmpl: typeof EXAMPLE_TEMPLATES[0]) => {
    setTemplate(tmpl.template);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Batch Processor</h1>
        {processing && (
          <Badge variant="default" className="ml-2 animate-pulse">Processing</Badge>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Input & Config */}
        <div className="lg:w-[420px] flex-shrink-0 border-r overflow-y-auto p-4 space-y-5">
          {/* Input Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Input Data</label>
              <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                {(["text", "csv", "json"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setInputMode(mode);
                      if (rawInput) parseInput(rawInput, mode);
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      inputMode === mode
                        ? "bg-background shadow-sm font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-xs text-muted-foreground">
                {parsedItems.length > 0 && `${parsedItems.length} items parsed`}
              </span>
            </div>

            <Textarea
              value={rawInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={
                inputMode === "json"
                  ? '["item 1", "item 2", "item 3"]'
                  : inputMode === "csv"
                  ? "CSV data (one item per row)..."
                  : "One item per line..."
              }
              className="min-h-[120px] font-mono text-sm"
              rows={5}
            />

            {/* Preview */}
            {parsedItems.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Preview (first 5 of {parsedItems.length})
                </label>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Item</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedItems.slice(0, 5).map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5 text-xs truncate max-w-[250px]">{item}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Processing Config */}
          <div className="space-y-3 pt-4 border-t">
            <label className="text-sm font-medium">Processing Template</label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder='Template with {{item}} placeholder...'
              className="min-h-[80px] font-mono text-sm"
              rows={3}
            />
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">{"{{item}}"} = each input item</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Concurrency</label>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {[1, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>{n} parallel</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex justify-between">
              Temperature <span className="text-muted-foreground">{temperature}</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Execution Buttons */}
          <div className="flex items-center gap-2">
            {!processing ? (
              <Button onClick={startProcessing} disabled={parsedItems.length === 0} className="gap-2 flex-1">
                <Play className="h-4 w-4" />
                Start Processing
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handlePause}
                  className="gap-2 flex-1"
                >
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button variant="destructive" onClick={handleCancel} className="gap-2">
                  <Square className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            )}
          </div>

          {/* Example Templates */}
          <div className="space-y-2 pt-4 border-t">
            <label className="text-sm font-medium flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              Example Templates
            </label>
            <div className="space-y-1.5">
              {EXAMPLE_TEMPLATES.map((tmpl, i) => (
                <button
                  key={i}
                  onClick={() => loadTemplate(tmpl)}
                  className="w-full text-left p-2.5 rounded-md border hover:border-primary/50 hover:bg-accent transition-colors"
                >
                  <p className="text-sm font-medium">{tmpl.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          {/* Progress Bar */}
          {batchItems.length > 0 && (
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Progress: {completedCount} / {batchItems.length}
                </span>
                {processing && remainingItems > 0 && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    ~{estimatedRemaining}s remaining
                  </span>
                )}
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {batchItems.filter((i) => i.status === "success").length} success
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  {batchItems.filter((i) => i.status === "error").length} errors
                </span>
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {batchItems.filter((i) => i.status === "processing").length} processing
                </span>
                <span>
                  {batchItems.filter((i) => i.status === "pending").length} pending
                </span>
              </div>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="p-4 border-b">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Total Processed</p>
                  <p className="text-xl font-bold">{summary.total}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                  <p className="text-xl font-bold text-green-600">
                    {summary.total > 0
                      ? Math.round((summary.success / summary.total) * 100)
                      : 0}
                    %
                  </p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Avg Response</p>
                  <p className="text-xl font-bold">{(summary.avgResponseTime / 1000).toFixed(2)}s</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Errors</p>
                  <p className="text-xl font-bold text-red-500">{summary.errors}</p>
                </Card>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportJSON} className="gap-1.5">
                  <FileJson className="h-3.5 w-3.5" />
                  Export JSON
                </Button>
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="flex-1 overflow-y-auto">
            {batchItems.length > 0 ? (
              <div className="min-w-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Input</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Output</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground w-24">Status</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground w-20">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`border-t transition-colors ${
                          item.status === "processing" ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.id + 1}</td>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <p className="truncate text-xs">{item.input}</p>
                        </td>
                        <td className="px-4 py-2.5 max-w-[300px]">
                          {item.status === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : item.status === "error" ? (
                            <span className="text-xs text-red-500">{item.error}</span>
                          ) : (
                            <p className="truncate text-xs">{item.output}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {item.status === "success" && (
                            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-0">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          )}
                          {item.status === "error" && (
                            <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-600 border-0">
                              <XCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                          {item.status === "processing" && (
                            <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-0">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Running
                            </Badge>
                          )}
                          {item.status === "pending" && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {item.time > 0 ? `${(item.time / 1000).toFixed(1)}s` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Table2 className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No results yet</p>
                <p className="text-sm">Add input data, configure a template, and start processing</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
