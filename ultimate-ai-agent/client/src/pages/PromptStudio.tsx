import { useState, useMemo, useCallback } from "react";
import {
  Play,
  Save,
  Copy,
  Check,
  Clock,
  BookOpen,
  GitCompare,
  Edit3,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  BarChart3,
  Library,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  systemPrompt: string;
  variables: string[];
  category: string;
}

interface SavedVersion {
  id: string;
  name: string;
  version: number;
  date: Date;
  template: string;
  systemPrompt: string;
  avgScore: number;
}

interface TestResult {
  content: string;
  tokenCount: number;
  responseTime: number;
  readabilityScore: number;
  responseLength: number;
  wordCount: number;
}

const PROMPT_LIBRARY: PromptTemplate[] = [
  { id: "1", name: "Summarizer", template: "Summarize the following text in a {{style}} style:\n\n{{text}}", systemPrompt: "You are an expert summarizer. Be concise and capture key points.", variables: ["text", "style"], category: "Writing" },
  { id: "2", name: "Translator", template: "Translate the following text to {{language}}:\n\n{{text}}", systemPrompt: "You are a professional translator. Maintain the original tone and meaning.", variables: ["text", "language"], category: "Language" },
  { id: "3", name: "Code Reviewer", template: "Review the following code for bugs, performance issues, and best practices:\n\n{{code}}", systemPrompt: "You are a senior software engineer conducting a code review. Be thorough but constructive.", variables: ["code"], category: "Development" },
  { id: "4", name: "Email Writer", template: "Write a professional email about {{topic}} to {{recipient}}.", systemPrompt: "You are a professional communication expert. Write clear, concise emails.", variables: ["topic", "recipient"], category: "Writing" },
  { id: "5", name: "SQL Generator", template: "Generate a SQL query for the following requirement:\n\n{{requirement}}", systemPrompt: "You are a database expert. Write clean, optimized SQL queries. Include comments explaining complex parts.", variables: ["requirement"], category: "Development" },
  { id: "6", name: "Regex Builder", template: "Create a regular expression for the following pattern description:\n\n{{pattern_description}}", systemPrompt: "You are a regex expert. Provide the regex pattern, explanation of each part, and test examples.", variables: ["pattern_description"], category: "Development" },
  { id: "7", name: "API Doc Generator", template: "Generate comprehensive API documentation for the following API specification:\n\n{{api_spec}}", systemPrompt: "You are a technical writer specializing in API documentation. Use OpenAPI/Swagger conventions.", variables: ["api_spec"], category: "Documentation" },
  { id: "8", name: "Test Case Writer", template: "Write comprehensive unit tests for the following function:\n\n{{function_description}}", systemPrompt: "You are a QA engineer. Write thorough test cases covering edge cases, happy paths, and error scenarios.", variables: ["function_description"], category: "Development" },
  { id: "9", name: "Bug Report Analyzer", template: "Analyze the following bug report and suggest possible causes and solutions:\n\n{{bug_report}}", systemPrompt: "You are a senior debugging specialist. Analyze systematically and provide actionable solutions.", variables: ["bug_report"], category: "Development" },
  { id: "10", name: "Data Schema Designer", template: "Design a database schema for the following requirements:\n\n{{requirements}}", systemPrompt: "You are a database architect. Design normalized, scalable schemas with proper relationships.", variables: ["requirements"], category: "Development" },
  { id: "11", name: "User Story Creator", template: "Create detailed user stories for the following feature:\n\n{{feature}}", systemPrompt: "You are a product manager. Write user stories in the format: As a [user], I want [action] so that [benefit]. Include acceptance criteria.", variables: ["feature"], category: "Product" },
  { id: "12", name: "Meeting Notes", template: "Summarize the following meeting transcript into structured notes with action items:\n\n{{transcript}}", systemPrompt: "You are an executive assistant. Extract key decisions, action items, and follow-ups from meetings.", variables: ["transcript"], category: "Productivity" },
  { id: "13", name: "Technical Writer", template: "Write technical documentation for the following topic:\n\n{{topic}}", systemPrompt: "You are a technical writer. Write clear, well-structured documentation with examples.", variables: ["topic"], category: "Documentation" },
  { id: "14", name: "Interview Questions", template: "Generate a comprehensive set of interview questions for a {{role}} position.", systemPrompt: "You are a hiring manager. Create questions that assess technical skills, problem-solving, and culture fit.", variables: ["role"], category: "HR" },
  { id: "15", name: "Changelog Writer", template: "Write a user-friendly changelog from the following commit messages:\n\n{{commits}}", systemPrompt: "You are a developer advocate. Write changelogs that are clear for both technical and non-technical readers.", variables: ["commits"], category: "Documentation" },
];

export default function PromptStudio() {
  const [activeTab, setActiveTab] = useState<"editor" | "abtest" | "library">("editor");

  // Editor state
  const [template, setTemplate] = useState("Summarize the following text in a {{style}} style:\n\n{{text}}");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [templateName, setTemplateName] = useState("My Prompt");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Version history
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [versionExpanded, setVersionExpanded] = useState(true);

  // A/B test state
  const [variantA, setVariantA] = useState("Summarize the following in a concise manner:\n\n{{text}}");
  const [variantB, setVariantB] = useState("Create a detailed summary of:\n\n{{text}}");
  const [abSystemPrompt, setAbSystemPrompt] = useState("You are a helpful assistant.");
  const [abVariableValues, setAbVariableValues] = useState<Record<string, string>>({});
  const [abResultA, setAbResultA] = useState<TestResult | null>(null);
  const [abResultB, setAbResultB] = useState<TestResult | null>(null);
  const [abLoading, setAbLoading] = useState(false);

  // Extract variables from template
  const detectedVariables = useMemo(() => {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
  }, [template]);

  const abVariables = useMemo(() => {
    const combined = (variantA + " " + variantB).match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(combined.map((m) => m.replace(/\{\{|\}\}/g, "")))];
  }, [variantA, variantB]);

  const buildPrompt = (tmpl: string, vars: Record<string, string>) => {
    let result = tmpl;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `[${key}]`);
    }
    return result;
  };

  const calculateReadability = (text: string) => {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    return Math.round((words.length / sentences.length) * 10) / 10;
  };

  const sendPrompt = useCallback(
    async (promptText: string, sysPmt: string): Promise<TestResult> => {
      const startTime = Date.now();
      const res = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: sysPmt },
            { role: "user", content: promptText },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || data.content || "";
      const responseTime = Date.now() - startTime;
      const words = content.split(/\s+/).filter((w: string) => w.length > 0);

      return {
        content,
        tokenCount: data.usage?.total || 0,
        responseTime,
        readabilityScore: calculateReadability(content),
        responseLength: content.length,
        wordCount: words.length,
      };
    },
    []
  );

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const prompt = buildPrompt(template, variableValues);
      const result = await sendPrompt(prompt, systemPrompt);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test prompt");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const newVersion: SavedVersion = {
      id: Date.now().toString(),
      name: templateName,
      version: savedVersions.filter((v) => v.name === templateName).length + 1,
      date: new Date(),
      template,
      systemPrompt,
      avgScore: testResult?.readabilityScore || 0,
    };
    setSavedVersions((prev) => [newVersion, ...prev]);
  };

  const handleAbTest = async () => {
    setAbLoading(true);
    setError(null);
    try {
      const promptA = buildPrompt(variantA, abVariableValues);
      const promptB = buildPrompt(variantB, abVariableValues);
      const [resultA, resultB] = await Promise.all([
        sendPrompt(promptA, abSystemPrompt),
        sendPrompt(promptB, abSystemPrompt),
      ]);
      setAbResultA(resultA);
      setAbResultB(resultB);
    } catch (err) {
      setError(err instanceof Error ? err.message : "A/B test failed");
    } finally {
      setAbLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadTemplate = (tmpl: PromptTemplate) => {
    setTemplate(tmpl.template);
    setSystemPrompt(tmpl.systemPrompt);
    setTemplateName(tmpl.name);
    setVariableValues({});
    setTestResult(null);
    setActiveTab("editor");
  };

  const loadVersion = (version: SavedVersion) => {
    setTemplate(version.template);
    setSystemPrompt(version.systemPrompt);
    setTemplateName(version.name);
    setVariableValues({});
    setTestResult(null);
  };

  const renderHighlightedTemplate = (text: string) => {
    const parts = text.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) =>
      part.match(/^\{\{\w+\}\}$/) ? (
        <span key={i} className="bg-primary/20 text-primary font-medium rounded px-0.5">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
      if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
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
      {/* Header with Tabs */}
      <div className="border-b px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Prompt Studio</h1>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === "editor" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5 inline mr-1" />
            Editor
          </button>
          <button
            onClick={() => setActiveTab("abtest")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === "abtest" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5 inline mr-1" />
            A/B Test
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === "library" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Library className="h-3.5 w-3.5 inline mr-1" />
            Library
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {/* Editor Tab */}
      {activeTab === "editor" && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Prompt Editor */}
          <div className="flex-1 flex flex-col border-r overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="max-w-xs font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">System Prompt</label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="System prompt..."
                className="min-h-[60px] text-sm"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                Prompt Template
                <Badge variant="secondary" className="text-xs">
                  {"{{variable}}"} syntax
                </Badge>
              </label>
              <div className="relative">
                <Textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="Write your prompt template using {{variable}} syntax..."
                  className="min-h-[150px] font-mono text-sm"
                  rows={6}
                />
                {/* Preview with highlighted variables */}
                <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                  {renderHighlightedTemplate(template)}
                </div>
              </div>
            </div>

            {/* Variables Section */}
            {detectedVariables.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  Variables
                  <Badge variant="outline" className="text-xs">{detectedVariables.length} detected</Badge>
                </label>
                <div className="space-y-2">
                  {detectedVariables.map((variable) => (
                    <div key={variable} className="flex items-center gap-2">
                      <Badge className="min-w-fit">{`{{${variable}}}`}</Badge>
                      <Textarea
                        value={variableValues[variable] || ""}
                        onChange={(e) =>
                          setVariableValues((prev) => ({ ...prev, [variable]: e.target.value }))
                        }
                        placeholder={`Value for ${variable}...`}
                        className="min-h-[40px] text-sm"
                        rows={1}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={handleTest} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Test Prompt
              </Button>
              <Button variant="outline" onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" />
                Save Template
              </Button>
            </div>
          </div>

          {/* Right: Results */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {testResult && !loading && (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Response</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => handleCopy(testResult.content)}>
                          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none">
                        {renderMarkdown(testResult.content)}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Tokens</p>
                      <p className="text-lg font-bold">{testResult.tokenCount}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Response Time
                      </p>
                      <p className="text-lg font-bold">{(testResult.responseTime / 1000).toFixed(2)}s</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" /> Readability
                      </p>
                      <p className="text-lg font-bold">{testResult.readabilityScore}</p>
                      <p className="text-xs text-muted-foreground">words/sentence</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Word Count</p>
                      <p className="text-lg font-bold">{testResult.wordCount}</p>
                    </Card>
                  </div>
                </>
              )}

              {!testResult && !loading && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium">No results yet</p>
                  <p className="text-sm">Test your prompt to see the response</p>
                </div>
              )}
            </div>

            {/* Version History */}
            <div className="border-t">
              <button
                onClick={() => setVersionExpanded(!versionExpanded)}
                className="w-full p-3 flex items-center gap-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                {versionExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Version History ({savedVersions.length})
              </button>
              {versionExpanded && (
                <div className="max-h-48 overflow-y-auto px-3 pb-3">
                  {savedVersions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No saved versions</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b">
                          <th className="pb-2 font-medium">Name</th>
                          <th className="pb-2 font-medium">Version</th>
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium">Score</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedVersions.map((version) => (
                          <tr key={version.id} className="border-b last:border-0">
                            <td className="py-2">{version.name}</td>
                            <td className="py-2">v{version.version}</td>
                            <td className="py-2 text-muted-foreground">
                              {version.date.toLocaleDateString()}
                            </td>
                            <td className="py-2">{version.avgScore}</td>
                            <td className="py-2">
                              <Button variant="ghost" size="sm" onClick={() => loadVersion(version)}>
                                Load
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* A/B Test Tab */}
      {activeTab === "abtest" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">System Prompt (shared)</label>
            <Textarea
              value={abSystemPrompt}
              onChange={(e) => setAbSystemPrompt(e.target.value)}
              placeholder="System prompt..."
              className="min-h-[60px] text-sm"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Variant A */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge className="bg-blue-500 hover:bg-blue-500">A</Badge>
                  Variant A
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={variantA}
                  onChange={(e) => setVariantA(e.target.value)}
                  placeholder="Variant A prompt template..."
                  className="min-h-[120px] font-mono text-sm"
                  rows={5}
                />
                {abResultA && (
                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded-md text-sm max-h-60 overflow-y-auto">
                      {renderMarkdown(abResultA.content)}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Tokens: {abResultA.tokenCount}</span>
                      <span>Time: {(abResultA.responseTime / 1000).toFixed(2)}s</span>
                      <span>Words: {abResultA.wordCount}</span>
                      <span>Readability: {abResultA.readabilityScore}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Variant B */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge className="bg-orange-500 hover:bg-orange-500">B</Badge>
                  Variant B
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={variantB}
                  onChange={(e) => setVariantB(e.target.value)}
                  placeholder="Variant B prompt template..."
                  className="min-h-[120px] font-mono text-sm"
                  rows={5}
                />
                {abResultB && (
                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded-md text-sm max-h-60 overflow-y-auto">
                      {renderMarkdown(abResultB.content)}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Tokens: {abResultB.tokenCount}</span>
                      <span>Time: {(abResultB.responseTime / 1000).toFixed(2)}s</span>
                      <span>Words: {abResultB.wordCount}</span>
                      <span>Readability: {abResultB.readabilityScore}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* A/B Variables */}
          {abVariables.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Test Variables</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {abVariables.map((variable) => (
                  <div key={variable} className="flex items-center gap-2">
                    <Badge variant="outline">{`{{${variable}}}`}</Badge>
                    <Textarea
                      value={abVariableValues[variable] || ""}
                      onChange={(e) =>
                        setAbVariableValues((prev) => ({ ...prev, [variable]: e.target.value }))
                      }
                      placeholder={`Value for ${variable}...`}
                      className="min-h-[40px] text-sm"
                      rows={1}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleAbTest} disabled={abLoading} className="gap-2">
            {abLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitCompare className="h-4 w-4" />
            )}
            Run A/B Test
          </Button>
        </div>
      )}

      {/* Library Tab */}
      {activeTab === "library" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROMPT_LIBRARY.map((tmpl) => (
              <Card key={tmpl.id} className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{tmpl.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">{tmpl.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground font-mono line-clamp-3">
                    {renderHighlightedTemplate(tmpl.template)}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {tmpl.variables.map((v) => (
                      <Badge key={v} variant="outline" className="text-xs">
                        {v}
                      </Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => loadTemplate(tmpl)} className="w-full gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
