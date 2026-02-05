import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import StructuredResponse from "./StructuredResponse";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

interface AIChatBoxProps {
  conversationId?: number;
  agentId?: string;
  model?: string;
  onConversationCreated?: (id: number) => void;
  className?: string;
}

export default function AIChatBox({
  conversationId,
  agentId,
  model,
  onConversationCreated,
  className,
}: AIChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConvId, setCurrentConvId] = useState(conversationId);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing messages
  const { data: existingMessages } = trpc.messages.list.useQuery(
    { conversationId: currentConvId! },
    { enabled: !!currentConvId }
  );

  const chatMutation = trpc.chat.send.useMutation();

  useEffect(() => {
    if (existingMessages) {
      setMessages(
        existingMessages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt,
        }))
      );
    }
  }, [existingMessages]);

  useEffect(() => {
    setCurrentConvId(conversationId);
  }, [conversationId]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    // Add streaming placeholder
    const assistantPlaceholder: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    try {
      // Try SSE streaming first
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConvId,
          message: trimmed,
          agentId,
          model,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";
        let newConvId = currentConvId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (typeof data === "object" && data !== null) {
                  // Handle done event
                } else if (typeof data === "number" && !newConvId) {
                  newConvId = data;
                  setCurrentConvId(data);
                  onConversationCreated?.(data);
                } else if (typeof data === "string") {
                  fullContent += data;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.isStreaming
                        ? { ...m, content: fullContent }
                        : m
                    )
                  );
                }
              } catch {
                // Skip non-JSON lines
              }
            }
          }
        }

        // Finalize the streaming message
        setMessages((prev) =>
          prev.map((m) =>
            m.isStreaming
              ? { ...m, content: fullContent, isStreaming: false }
              : m
          )
        );
      } else {
        // Fallback to tRPC mutation
        const result = await chatMutation.mutateAsync({
          conversationId: currentConvId,
          message: trimmed,
          agentId,
          model,
        });

        if (!currentConvId) {
          setCurrentConvId(result.conversationId);
          onConversationCreated?.(result.conversationId);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.isStreaming
              ? {
                  id: result.message.id,
                  role: "assistant" as const,
                  content: result.message.content,
                  createdAt: result.message.createdAt,
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.isStreaming
            ? {
                ...m,
                content:
                  "An error occurred while processing your message. Please check your API configuration and try again.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (content: string, id: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRetry = () => {
    if (messages.length < 2) return;
    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMsg) {
      // Remove last assistant message
      setMessages((prev) => prev.slice(0, -1));
      setInput(lastUserMsg.content);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setCurrentConvId(undefined);
    setInput("");
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background rounded-lg border",
        className
      )}
    >
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-medium">AI Chat</span>
          {agentId && (
            <Badge variant="secondary" className="text-xs">
              {agentId}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRetry}
            disabled={messages.length < 2 || isLoading}
            title="Retry last message"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={messages.length === 0}
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Start a conversation
            </h3>
            <p className="text-sm text-muted-foreground/70 max-w-sm">
              Type a message below to begin chatting with the AI assistant.
              You can ask questions, get help with coding, or just have a conversation.
            </p>
            <div className="flex flex-wrap gap-2 mt-6 max-w-md justify-center">
              {[
                "Explain how React hooks work",
                "Write a Python sorting algorithm",
                "Help me plan a project",
                "What is machine learning?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="relative group">
                      {message.isStreaming && !message.content ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            Thinking...
                          </span>
                        </div>
                      ) : (
                        <>
                          <StructuredResponse content={message.content} />
                          {message.isStreaming && (
                            <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                          )}
                        </>
                      )}
                      {!message.isStreaming && message.content && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() =>
                            handleCopy(message.content, message.id)
                          }
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="min-h-[44px] max-h-[200px] resize-none"
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px] flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
