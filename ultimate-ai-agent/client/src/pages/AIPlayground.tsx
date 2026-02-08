import { useState, useEffect, useCallback, useRef } from "react";
import {
  Send,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  ToggleLeft,
  ToggleRight,
  Columns,
  MessageSquare,
  History,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

interface PlaygroundResponse {
  content: string;
  tokenUsage: TokenUsage;
  responseTime: number;
  model: string;
}

interface PlaygroundSession {
  id: string;
  timestamp: Date;
  model: string;
  prompt: string;
  response: string;
  tokenUsage: TokenUsage;
}

const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

export default function AIPlayground() {
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant");
  const [systemPromptCollapsed, setSystemPromptCollapsed] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(1.0);

  const [responses, setResponses] = useState<PlaygroundResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonModels, setComparisonModels] = useState<string[]>(["gpt-4o-mini", "gpt-4o"]);
  const [comparisonResponses, setComparisonResponses] = useState<PlaygroundResponse[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const [conversationMode, setConversationMode] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);

  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<PlaygroundSession[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendRequest = useCallback(
    async (model: string, messages: Message[]): Promise<PlaygroundResponse> => {
      const startTime = Date.now();
      const res = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const responseTime = Date.now() - startTime;

      return {
        content: data.choices?.[0]?.message?.content || data.content || "No response received",
        tokenUsage: data.usage || { prompt: 0, completion: 0, total: 0 },
        responseTime,
        model,
      };
    },
    [temperature, maxTokens, topP]
  );

  const handleSend = useCallback(async () => {
    if (!userMessage.trim()) return;

    setLoading(true);
    setError(null);

    const messages: Message[] = conversationMode
      ? [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: userMessage },
        ]
      : [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ];

    try {
      if (comparisonMode) {
        setComparisonLoading(true);
        const results = await Promise.all(
          comparisonModels.map((model) => sendRequest(model, messages))
        );
        setComparisonResponses(results);
        setComparisonLoading(false);
      } else {
        const result = await sendRequest(selectedModel, messages);
        setResponses((prev) => [result, ...prev]);

        if (conversationMode) {
          setConversationHistory((prev) => [
            ...prev,
            { role: "user", content: userMessage },
            { role: "assistant", content: result.content },
          ]);
        }

        setSessions((prev) => [
          {
            id: Date.now().toString(),
            timestamp: new Date(),
            model: selectedModel,
            prompt: userMessage,
            response: result.content,
            tokenUsage: result.tokenUsage,
          },
          ...prev,
        ]);
      }

      setUserMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [
    userMessage,
    systemPrompt,
    selectedModel,
    conversationMode,
    conversationHistory,
    comparisonMode,
    comparisonModels,
    sendRequest,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSend]);

  const handleClear = () => {
    setUserMessage("");
    setResponses([]);
    setComparisonResponses([]);
    setConversationHistory([]);
    setError(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleComparisonModel = (modelId: string) => {
    setComparisonModels((prev) => {
      if (prev.includes(modelId)) {
        if (prev.length <= 2) return prev;
        return prev.filter((m) => m !== modelId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, modelId];
    });
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
      if (line.startsWith("```")) return <div key={i} className="bg-muted rounded px-2 py-0.5 font-mono text-sm" />;
      if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
      if (line.startsWith("> ")) return <blockquote key={i} className="border-l-4 border-primary/30 pl-3 italic text-muted-foreground">{line.slice(2)}</blockquote>;
      if (line.match(/^\d+\. /)) return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\. /, "")}</li>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
      if (line.trim() === "") return <br key={i} />;
      const formatted = line
        .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
      return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* History Sidebar */}
      {historySidebarOpen && (
        <div className="w-72 border-r bg-card flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Session History
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setHistorySidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No sessions yet</p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setUserMessage(session.prompt);
                    setSelectedModel(session.model);
                  }}
                  className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors"
                >
                  <p className="text-sm font-medium truncate">{session.prompt}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{session.model}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {session.tokenUsage.total} tokens
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {session.timestamp.toLocaleTimeString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Input Panel */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        <div className="flex-1 flex flex-col border-r min-w-0">
          <div className="p-4 border-b flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {!historySidebarOpen && (
                <Button variant="ghost" size="icon" onClick={() => setHistorySidebarOpen(true)}>
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                AI Playground
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={conversationMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setConversationMode(!conversationMode);
                  setConversationHistory([]);
                }}
                className="gap-1"
              >
                {conversationMode ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                <MessageSquare className="h-3 w-3" />
                Conversation
              </Button>
              <Button
                variant={comparisonMode ? "default" : "outline"}
                size="sm"
                onClick={() => setComparisonMode(!comparisonMode)}
                className="gap-1"
              >
                <Columns className="h-4 w-4" />
                Compare
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* System Prompt */}
            <div className="space-y-2">
              <button
                onClick={() => setSystemPromptCollapsed(!systemPromptCollapsed)}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {systemPromptCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                System Prompt
              </button>
              {!systemPromptCollapsed && (
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                  className="min-h-[60px] text-sm"
                  rows={2}
                />
              )}
            </div>

            {/* Conversation History */}
            {conversationMode && conversationHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Conversation History</p>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {conversationHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`text-sm p-2 rounded ${
                        msg.role === "user" ? "bg-primary/10 ml-4" : "bg-muted mr-4"
                      }`}
                    >
                      <span className="font-medium text-xs uppercase text-muted-foreground">
                        {msg.role}:
                      </span>
                      <p className="mt-0.5 line-clamp-3">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                ref={textareaRef}
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Ctrl+Enter to send)"
                className="min-h-[120px]"
                rows={5}
              />
            </div>

            {/* Model Selection */}
            {comparisonMode ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select 2-3 Models to Compare</label>
                <div className="flex flex-wrap gap-2">
                  {MODELS.map((model) => (
                    <Button
                      key={model.id}
                      variant={comparisonModels.includes(model.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleComparisonModel(model.id)}
                    >
                      {model.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Parameter Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div className="space-y-2">
                <label className="text-sm font-medium flex justify-between">
                  Max Tokens <span className="text-muted-foreground">{maxTokens}</span>
                </label>
                <input
                  type="range"
                  min="100"
                  max="4096"
                  step="100"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex justify-between">
                  Top P <span className="text-muted-foreground">{topP}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button onClick={handleSend} disabled={loading || !userMessage.trim()} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {comparisonMode ? "Compare" : "Send"}
              </Button>
              <Button variant="outline" onClick={handleClear} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">Ctrl+Enter to send</span>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Output Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/30">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">Output</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Comparison Mode Results */}
            {comparisonMode && comparisonResponses.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {comparisonResponses.map((resp, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge>{resp.model}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(resp.content)}
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none text-sm">
                        {renderMarkdown(resp.content)}
                      </div>
                      <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <p className="font-medium">Prompt</p>
                          <p>{resp.tokenUsage.prompt}</p>
                        </div>
                        <div>
                          <p className="font-medium">Completion</p>
                          <p>{resp.tokenUsage.completion}</p>
                        </div>
                        <div>
                          <p className="font-medium">Time</p>
                          <p>{(resp.responseTime / 1000).toFixed(2)}s</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Single Mode Results */}
            {!comparisonMode &&
              responses.map((resp, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge>{resp.model}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {(resp.responseTime / 1000).toFixed(2)}s
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(resp.content)}
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      {renderMarkdown(resp.content)}
                    </div>
                    <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Prompt:</span> {resp.tokenUsage.prompt}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Completion:</span> {resp.tokenUsage.completion}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Total:</span> {resp.tokenUsage.total}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

            {!loading && responses.length === 0 && comparisonResponses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Zap className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No responses yet</p>
                <p className="text-sm">Send a message to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
