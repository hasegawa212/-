import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  Search,
  Copy,
  Check,
  Loader2,
  BookOpen,
  ListChecks,
  Languages,
  Smile,
  HelpCircle,
  Zap,
  Download,
  X,
  Clock,
  Type,
  BarChart3,
  ArrowRight,
  GitCompare,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface DocumentFile {
  id: string;
  name: string;
  content: string;
  timestamp: Date;
  stats: DocumentStats;
}

interface DocumentStats {
  wordCount: number;
  charCount: number;
  readingTime: number;
  language: string;
}

interface AnalysisResult {
  action: string;
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { id: "summarize", label: "Summarize", icon: BookOpen, prompt: "Provide a comprehensive summary of the following document:" },
  { id: "key-points", label: "Extract Key Points", icon: ListChecks, prompt: "Extract the key points from the following document as a bulleted list:" },
  { id: "action-items", label: "Find Action Items", icon: Zap, prompt: "Identify and list all action items, tasks, or to-dos from the following document:" },
  { id: "translate", label: "Translate", icon: Languages, prompt: "Translate the following document to Spanish:" },
  { id: "simplify", label: "Simplify", icon: Type, prompt: "Rewrite the following document in simpler, more accessible language:" },
  { id: "sentiment", label: "Analyze Sentiment", icon: Smile, prompt: "Analyze the sentiment and tone of the following document. Identify emotional themes and overall tone:" },
  { id: "faq", label: "Generate FAQ", icon: HelpCircle, prompt: "Generate a comprehensive FAQ (Frequently Asked Questions) based on the following document:" },
];

function detectLanguage(text: string): string {
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
  const chineseRegex = /[\u4E00-\u9FFF]/;
  const koreanRegex = /[\uAC00-\uD7AF]/;
  const arabicRegex = /[\u0600-\u06FF]/;
  const cyrillicRegex = /[\u0400-\u04FF]/;

  if (japaneseRegex.test(text)) return "Japanese";
  if (koreanRegex.test(text)) return "Korean";
  if (chineseRegex.test(text)) return "Chinese";
  if (arabicRegex.test(text)) return "Arabic";
  if (cyrillicRegex.test(text)) return "Russian/Cyrillic";
  return "English";
}

function calculateStats(text: string): DocumentStats {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return {
    wordCount: words.length,
    charCount: text.length,
    readingTime: Math.max(1, Math.ceil(words.length / 200)),
    language: detectLanguage(text),
  };
}

export default function DocumentAnalyzer() {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentFile | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [customQuery, setCustomQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [compareMode, setCompareMode] = useState(false);
  const [compareDoc, setCompareDoc] = useState<DocumentFile | null>(null);
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const text = await file.text();
    const doc: DocumentFile = {
      id: Date.now().toString(),
      name: file.name,
      content: text,
      timestamp: new Date(),
      stats: calculateStats(text),
    };
    setDocuments((prev) => [doc, ...prev]);
    setActiveDoc(doc);
    setResults([]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      const valid = files.filter((f) =>
        [".txt", ".md", ".json", ".csv", ".pdf"].some((ext) => f.name.toLowerCase().endsWith(ext))
      );
      if (valid.length > 0) processFile(valid[0]);
    },
    [processFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handlePasteText = () => {
    const text = prompt("Paste your document text:");
    if (text && text.trim()) {
      const doc: DocumentFile = {
        id: Date.now().toString(),
        name: "Pasted Document",
        content: text,
        timestamp: new Date(),
        stats: calculateStats(text),
      };
      setDocuments((prev) => [doc, ...prev]);
      setActiveDoc(doc);
      setResults([]);
    }
  };

  const analyzeDocument = async (action: string, promptText: string) => {
    if (!activeDoc) return;
    setLoadingAction(action);
    setError(null);

    try {
      const res = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a document analysis expert. Provide clear, well-structured analysis." },
            { role: "user", content: `${promptText}\n\n---\n\n${activeDoc.content}` },
          ],
          temperature: 0.5,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || data.content || "No response";

      setResults((prev) => [
        { action, content, timestamp: new Date() },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCustomQuery = () => {
    if (!customQuery.trim()) return;
    analyzeDocument("Custom Query", `Answer the following question about this document: ${customQuery}`);
    setCustomQuery("");
  };

  const handleCompare = async () => {
    if (!activeDoc || !compareDoc) return;
    setCompareLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a document comparison expert. Highlight key differences and similarities." },
            {
              role: "user",
              content: `Compare the following two documents and highlight their key differences and similarities:\n\n--- Document 1: ${activeDoc.name} ---\n${activeDoc.content}\n\n--- Document 2: ${compareDoc.name} ---\n${compareDoc.content}`,
            },
          ],
          temperature: 0.5,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setCompareResult(data.choices?.[0]?.message?.content || data.content || "No response");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setCompareLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportResultsAsMarkdown = () => {
    const md = results
      .map((r) => `## ${r.action}\n\n${r.content}\n\n---`)
      .join("\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${activeDoc?.name || "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
      if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
      if (line.match(/^\d+\. /)) return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\. /, "")}</li>;
      if (line.trim() === "") return <br key={i} />;
      const formatted = line
        .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
      return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Document Analyzer</h1>
          {activeDoc && <Badge variant="secondary">{activeDoc.name}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportResultsAsMarkdown} className="gap-2">
              <Download className="h-4 w-4" />
              Export MD
            </Button>
          )}
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            onClick={() => setCompareMode(!compareMode)}
            className="gap-2"
          >
            <GitCompare className="h-4 w-4" />
            Compare
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Document Preview */}
        <div className="flex-1 flex flex-col border-r overflow-hidden">
          {!activeDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              {/* Upload Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`w-full max-w-md border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">Drop your document here</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports .txt, .md, .json, .csv, .pdf
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Browse Files
                  </Button>
                  <Button onClick={handlePasteText} variant="outline" className="gap-2">
                    <Type className="h-4 w-4" />
                    Paste Text
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json,.csv,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Recent Documents */}
              {documents.length > 0 && (
                <div className="w-full max-w-md mt-8">
                  <h3 className="text-sm font-medium mb-3">Recent Documents</h3>
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => {
                          setActiveDoc(doc);
                          setResults([]);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors text-left"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.stats.wordCount} words - {doc.timestamp.toLocaleString()}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Document Header */}
              <div className="p-3 border-b flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{activeDoc.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveDoc(null);
                    setResults([]);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Document Stats */}
              <div className="px-3 py-2 border-b flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Type className="h-3 w-3" />
                  {activeDoc.stats.wordCount} words
                </span>
                <span>{activeDoc.stats.charCount.toLocaleString()} chars</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{activeDoc.stats.readingTime} min read
                </span>
                <Badge variant="outline" className="text-xs">
                  {activeDoc.stats.language}
                </Badge>
              </div>

              {/* Document Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {activeDoc.content}
                </pre>
              </div>

              {/* Compare Mode */}
              {compareMode && (
                <div className="border-t p-3 space-y-3">
                  <label className="text-sm font-medium">Compare with:</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={compareDoc?.id || ""}
                      onChange={(e) =>
                        setCompareDoc(documents.find((d) => d.id === e.target.value) || null)
                      }
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select a document...</option>
                      {documents
                        .filter((d) => d.id !== activeDoc.id)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={!compareDoc || compareLoading}
                      onClick={handleCompare}
                      className="gap-2"
                    >
                      {compareLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <GitCompare className="h-4 w-4" />
                      )}
                      Compare
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Analysis Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          <div className="p-3 border-b">
            <h2 className="text-sm font-bold mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    disabled={!activeDoc || loadingAction !== null}
                    onClick={() => analyzeDocument(action.label, action.prompt)}
                    className="gap-1.5"
                  >
                    {loadingAction === action.label ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Custom Query */}
          <div className="px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <Input
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomQuery()}
                placeholder="Ask a custom question about the document..."
                disabled={!activeDoc}
                className="text-sm"
              />
              <Button
                size="sm"
                disabled={!activeDoc || !customQuery.trim() || loadingAction !== null}
                onClick={handleCustomQuery}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {compareResult && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GitCompare className="h-4 w-4" />
                      Document Comparison
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(compareResult)}>
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    {renderMarkdown(compareResult)}
                  </div>
                </CardContent>
              </Card>
            )}

            {results.map((result, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{result.action}</CardTitle>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(result.content)}>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    {renderMarkdown(result.content)}
                  </div>
                </CardContent>
              </Card>
            ))}

            {results.length === 0 && !compareResult && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No analysis yet</p>
                <p className="text-sm">
                  {activeDoc
                    ? "Use the quick actions or ask a custom question"
                    : "Upload a document to get started"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
