import { useState, useCallback } from "react";
import {
  Code2,
  Play,
  Copy,
  Check,
  Download,
  Loader2,
  MessageSquare,
  Send,
  Lightbulb,
  TestTube2,
  RefreshCw,
  ArrowRightLeft,
  ClipboardPaste,
  Search,
  FileCode,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface GeneratedCode {
  id: string;
  description: string;
  language: string;
  framework: string;
  code: string;
  timestamp: Date;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C#",
  "Ruby",
  "PHP",
  "SQL",
  "HTML/CSS",
  "Shell",
];

const COMPLEXITY_LEVELS = [
  { id: "simple", label: "Simple", description: "Basic implementation" },
  { id: "medium", label: "Medium", description: "With error handling" },
  { id: "complex", label: "Complex", description: "Production-ready" },
];

const KEYWORD_COLORS: Record<string, string> = {
  keyword: "text-purple-400",
  string: "text-green-400",
  comment: "text-gray-500",
  number: "text-orange-400",
  function: "text-blue-400",
  type: "text-yellow-400",
};

function highlightCode(code: string, language: string): string {
  let highlighted = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Comments
  highlighted = highlighted.replace(
    /(\/\/.*$|#.*$)/gm,
    '<span class="text-gray-500 italic">$1</span>'
  );
  highlighted = highlighted.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span class="text-gray-500 italic">$1</span>'
  );

  // Strings
  highlighted = highlighted.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
    '<span class="text-green-400">$1</span>'
  );

  // Numbers
  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="text-orange-400">$1</span>'
  );

  // Keywords
  const keywords =
    "\\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|import|export|from|default|async|await|try|catch|throw|new|this|super|yield|of|in|typeof|instanceof|void|null|undefined|true|false|def|self|print|elif|pass|raise|with|as|lambda|None|True|False|fn|pub|mod|use|impl|struct|enum|trait|match|mut|loop|crate|static|final|public|private|protected|abstract|interface|package|throws|int|string|bool|float|double|char|byte|long|short|func|type|map|range|defer|go|chan|select|require|include|echo|foreach|array|elsif|end|begin|rescue|ensure|module|puts|when|then|until)\\b";
  highlighted = highlighted.replace(
    new RegExp(keywords, "g"),
    '<span class="text-purple-400 font-semibold">$1</span>'
  );

  return highlighted;
}

export default function CodeGenerator() {
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [framework, setFramework] = useState("");
  const [complexity, setComplexity] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [generatedCode, setGeneratedCode] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [reviewMode, setReviewMode] = useState(false);
  const [reviewCode, setReviewCode] = useState("");
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [recentCodes, setRecentCodes] = useState<GeneratedCode[]>([]);

  const sendToAI = useCallback(
    async (systemMsg: string, userMsg: string): Promise<string> => {
      const res = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || data.content || "";
    },
    []
  );

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setActionResult(null);
    setChatMessages([]);

    const complexityDesc = COMPLEXITY_LEVELS.find((c) => c.id === complexity)?.description || "";

    try {
      const result = await sendToAI(
        `You are an expert ${language} developer. Generate clean, well-commented code. Return ONLY the code, no explanations before or after. Use proper formatting and best practices.${
          framework ? ` Use the ${framework} framework.` : ""
        }`,
        `Generate ${complexity} ${language} code (${complexityDesc}) for the following:\n\n${description}`
      );

      const code = result
        .replace(/^```[\w]*\n?/gm, "")
        .replace(/```$/gm, "")
        .trim();

      setGeneratedCode(code);
      setRecentCodes((prev) => [
        {
          id: Date.now().toString(),
          description,
          language,
          framework,
          code,
          timestamp: new Date(),
        },
        ...prev.slice(0, 19),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeAction = async (action: string) => {
    if (!generatedCode) return;
    setActiveAction(action);
    setError(null);

    const prompts: Record<string, { system: string; user: string }> = {
      explain: {
        system: "You are a code educator. Explain code clearly with line-by-line breakdowns.",
        user: `Explain the following ${language} code line by line:\n\n${generatedCode}`,
      },
      tests: {
        system: `You are a test engineer specializing in ${language}. Write comprehensive unit tests. Return ONLY the test code.`,
        user: `Write unit tests for the following ${language} code:\n\n${generatedCode}`,
      },
      refactor: {
        system: `You are a senior ${language} developer. Suggest improvements and refactor the code. Show the improved version and explain changes.`,
        user: `Refactor and improve this ${language} code:\n\n${generatedCode}`,
      },
      convert: {
        system:
          "You are a polyglot programmer. Convert code between languages while maintaining functionality. Return ONLY the converted code.",
        user: `Convert this ${language} code to Python (or another language if already Python, use JavaScript):\n\n${generatedCode}`,
      },
    };

    const p = prompts[action];
    if (!p) return;

    try {
      const result = await sendToAI(p.system, p.user);
      setActionResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setActiveAction(null);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || !generatedCode) return;
    const userMsg = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const contextMessages = [
        ...chatMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userMsg },
      ];

      const res = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a helpful ${language} developer. The user is iterating on the following code. Apply the requested changes and return the updated code. If the user asks a question, answer concisely.\n\nCurrent code:\n${generatedCode}`,
            },
            ...contextMessages,
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const response = data.choices?.[0]?.message?.content || data.content || "";

      setChatMessages((prev) => [...prev, { role: "assistant", content: response }]);

      // Try to extract updated code
      const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeMatch) {
        setGeneratedCode(codeMatch[1].trim());
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Failed"}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCodeReview = async () => {
    if (!reviewCode.trim()) return;
    setReviewLoading(true);
    setError(null);

    try {
      const result = await sendToAI(
        "You are a senior code reviewer. Review the code for: bugs, performance, security, readability, best practices. Provide specific suggestions with code examples where applicable.",
        `Review this code:\n\n${reviewCode}`
      );
      setReviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (code: string, ext: string) => {
    const extensions: Record<string, string> = {
      JavaScript: "js",
      TypeScript: "ts",
      Python: "py",
      Go: "go",
      Rust: "rs",
      Java: "java",
      "C#": "cs",
      Ruby: "rb",
      PHP: "php",
      SQL: "sql",
      "HTML/CSS": "html",
      Shell: "sh",
    };
    const fileExt = extensions[ext] || "txt";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated-code.${fileExt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    const elements: JSX.Element[] = [];

    lines.forEach((line, i) => {
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre key={i} className="bg-gray-900 text-gray-100 rounded-md p-3 text-sm font-mono overflow-x-auto my-2">
              <code dangerouslySetInnerHTML={{ __html: highlightCode(codeBlockContent.join("\n"), language) }} />
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      if (line.startsWith("### ")) {
        elements.push(<h3 key={i} className="text-lg font-semibold mt-3 mb-1">{line.slice(4)}</h3>);
      } else if (line.startsWith("## ")) {
        elements.push(<h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>);
      } else if (line.startsWith("- ")) {
        elements.push(<li key={i} className="ml-4 list-disc text-sm">{line.slice(2)}</li>);
      } else if (line.match(/^\d+\. /)) {
        elements.push(<li key={i} className="ml-4 list-decimal text-sm">{line.replace(/^\d+\. /, "")}</li>);
      } else if (line.trim() === "") {
        elements.push(<br key={i} />);
      } else {
        const formatted = line
          .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/\*([^*]+)\*/g, "<em>$1</em>");
        elements.push(<p key={i} className="my-1 text-sm" dangerouslySetInnerHTML={{ __html: formatted }} />);
      }
    });

    if (inCodeBlock && codeBlockContent.length > 0) {
      elements.push(
        <pre key="final-code" className="bg-gray-900 text-gray-100 rounded-md p-3 text-sm font-mono overflow-x-auto my-2">
          <code dangerouslySetInnerHTML={{ __html: highlightCode(codeBlockContent.join("\n"), language) }} />
        </pre>
      );
    }

    return elements;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Code Generator</h1>
        </div>
        <Button
          variant={reviewMode ? "default" : "outline"}
          size="sm"
          onClick={() => setReviewMode(!reviewMode)}
          className="gap-1.5"
        >
          <Search className="h-4 w-4" />
          Code Review
        </Button>
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {/* Code Review Mode */}
      {reviewMode ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 flex flex-col border-r overflow-y-auto p-4 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4" />
              Paste Code for Review
            </h2>
            <Textarea
              value={reviewCode}
              onChange={(e) => setReviewCode(e.target.value)}
              placeholder="Paste your code here for AI review..."
              className="flex-1 min-h-[300px] font-mono text-sm"
            />
            <Button
              onClick={handleCodeReview}
              disabled={reviewLoading || !reviewCode.trim()}
              className="gap-2"
            >
              {reviewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Review Code
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {reviewLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {reviewResult && !reviewLoading && (
              <div className="prose prose-sm max-w-none">{renderMarkdown(reviewResult)}</div>
            )}
            {!reviewResult && !reviewLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">Paste code and click Review</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left: Input */}
            <div className="lg:w-96 flex-shrink-0 border-r overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you want to build..."
                  className="min-h-[120px]"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Framework (optional)</label>
                <Input
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  placeholder="React, Express, FastAPI..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Complexity</label>
                <div className="grid grid-cols-3 gap-2">
                  {COMPLEXITY_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setComplexity(level.id)}
                      className={`p-2 rounded-md border text-center transition-all ${
                        complexity === level.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <p className="text-sm font-medium">{level.label}</p>
                      <p className="text-xs text-muted-foreground">{level.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading || !description.trim()}
                className="w-full gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Generate
              </Button>

              {/* Recent Codes */}
              {recentCodes.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {recentCodes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setDescription(item.description);
                          setLanguage(item.language);
                          setFramework(item.framework);
                          setGeneratedCode(item.code);
                        }}
                        className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors"
                      >
                        <p className="text-sm truncate">{item.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-xs">{item.language}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Output */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}

                {generatedCode && !loading && (
                  <>
                    {/* Code Display */}
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" />
                            <CardTitle className="text-base">Generated Code</CardTitle>
                            <Badge variant="secondary">{language}</Badge>
                            {framework && <Badge variant="outline">{framework}</Badge>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(generatedCode)}
                              className="gap-1"
                            >
                              {copied ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              Copy
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(generatedCode, language)}
                              className="gap-1"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="bg-gray-900 text-gray-100 rounded-md p-4 text-sm font-mono overflow-x-auto leading-relaxed">
                          <code
                            dangerouslySetInnerHTML={{
                              __html: highlightCode(generatedCode, language),
                            }}
                          />
                        </pre>
                      </CardContent>
                    </Card>

                    {/* Code Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCodeAction("explain")}
                        disabled={activeAction !== null}
                        className="gap-1.5"
                      >
                        {activeAction === "explain" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Lightbulb className="h-3.5 w-3.5" />
                        )}
                        Explain Code
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCodeAction("tests")}
                        disabled={activeAction !== null}
                        className="gap-1.5"
                      >
                        {activeAction === "tests" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TestTube2 className="h-3.5 w-3.5" />
                        )}
                        Add Tests
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCodeAction("refactor")}
                        disabled={activeAction !== null}
                        className="gap-1.5"
                      >
                        {activeAction === "refactor" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Refactor
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCodeAction("convert")}
                        disabled={activeAction !== null}
                        className="gap-1.5"
                      >
                        {activeAction === "convert" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        )}
                        Convert Language
                      </Button>
                    </div>

                    {/* Action Result */}
                    {actionResult && (
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Result</CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActionResult(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="prose prose-sm max-w-none">
                            {renderMarkdown(actionResult)}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {!generatedCode && !loading && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Code2 className="h-12 w-12 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No code generated yet</p>
                    <p className="text-sm">Describe what you want to build and click Generate</p>
                  </div>
                )}
              </div>

              {/* Chat for Iterating */}
              {generatedCode && (
                <div className="border-t p-3 space-y-2">
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-sm p-2 rounded ${
                          msg.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8"
                        }`}
                      >
                        <p className="line-clamp-3">{msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content}</p>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                      placeholder="Iterate: Add error handling, Make async, Add types..."
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      disabled={chatLoading || !chatInput.trim()}
                      onClick={handleChatSend}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
