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
  Mic,
  MicOff,
  Paperclip,
  Search,
  Download,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import StructuredResponse from "./StructuredResponse";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { exportAsJSON, exportAsCSV } from "@/lib/exportUtils";

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
  imageUrl?: string;
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
  const [isRecording, setIsRecording] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { t } = useI18n();
  const { addNotification } = useNotifications();

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // Voice input
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          if (response.ok) {
            const data = await response.json();
            setInput((prev) => prev + data.text);
          }
        } catch {
          addNotification("warning", "Voice Input", "Audio transcription requires OPENAI_API_KEY");
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      addNotification("error", "Microphone", "Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // File upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
        setAttachedFileName(file.name);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setInput((prev) =>
          prev + (prev ? "\n\n" : "") + `[File: ${file.name}]\n${text.slice(0, 5000)}`
        );
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !attachedImage) || isLoading) return;

    let messageContent = trimmed;
    if (attachedImage) {
      messageContent = trimmed
        ? `[Image: ${attachedFileName}]\n\n${trimmed}`
        : `[Image: ${attachedFileName}] Please analyze this image.`;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: messageContent,
      createdAt: new Date().toISOString(),
      imageUrl: attachedImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachedImage(null);
    setAttachedFileName(null);
    setIsLoading(true);
    setStreamingContent("");

    const assistantPlaceholder: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConvId,
          message: messageContent,
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
                if (typeof data === "number" && !newConvId) {
                  newConvId = data;
                  setCurrentConvId(data);
                  onConversationCreated?.(data);
                } else if (typeof data === "string") {
                  fullContent += data;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.isStreaming ? { ...m, content: fullContent } : m
                    )
                  );
                }
              } catch {
                // Skip
              }
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.isStreaming ? { ...m, content: fullContent, isStreaming: false } : m
          )
        );
      } else {
        const result = await chatMutation.mutateAsync({
          conversationId: currentConvId,
          message: messageContent,
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
          m.isStreaming ? { ...m, content: t("chat.error"), isStreaming: false } : m
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
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      setMessages((prev) => prev.slice(0, -1));
      setInput(lastUserMsg.content);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setCurrentConvId(undefined);
    setInput("");
    setAttachedImage(null);
    setAttachedFileName(null);
  };

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className={cn("flex flex-col h-full bg-background rounded-lg border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-medium">{t("chat.title")}</span>
          {agentId && <Badge variant="secondary" className="text-xs">{agentId}</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(!showSearch)}>
            <Search className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowExportMenu(!showExportMenu)} disabled={messages.length === 0}>
              <Download className="h-4 w-4" />
            </Button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-card border rounded-md shadow-lg z-50 py-1">
                  <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent" onClick={() => { exportAsJSON(messages); setShowExportMenu(false); addNotification("success", "Export", "JSON exported"); }}>{t("chat.exportJSON")}</button>
                  <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent" onClick={() => { exportAsCSV(messages); setShowExportMenu(false); addNotification("success", "Export", "CSV exported"); }}>{t("chat.exportCSV")}</button>
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleRetry} disabled={messages.length < 2 || isLoading} title={t("chat.retry")}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClear} disabled={messages.length === 0} title={t("chat.clear")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showSearch && (
        <div className="px-4 py-2 border-b">
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("chat.search")} className="h-8 text-sm" autoFocus />
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {filteredMessages.length === 0 && !searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">{t("chat.startConversation")}</h3>
            <p className="text-sm text-muted-foreground/70 max-w-sm">{t("chat.startDescription")}</p>
            <div className="flex flex-wrap gap-2 mt-6 max-w-md justify-center">
              {[t("suggest.react"), t("suggest.python"), t("suggest.plan"), t("suggest.ml")].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredMessages.map((message) => (
              <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-3", message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {message.role === "assistant" ? (
                    <div className="relative group">
                      {message.isStreaming && !message.content ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">{t("chat.thinking")}</span>
                        </div>
                      ) : (
                        <>
                          <StructuredResponse content={message.content} />
                          {message.isStreaming && <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />}
                        </>
                      )}
                      {!message.isStreaming && message.content && (
                        <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopy(message.content, message.id)}>
                          {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div>
                      {message.imageUrl && <img src={message.imageUrl} alt="Attached" className="max-w-full max-h-48 rounded-lg mb-2" />}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
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

      {/* Image preview */}
      {attachedImage && (
        <div className="px-4 py-2 border-t">
          <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
            <img src={attachedImage} alt="Attached" className="h-16 w-16 object-cover rounded" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{attachedFileName}</p>
              <p className="text-xs text-muted-foreground">{t("chat.imageAttached")}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setAttachedImage(null); setAttachedFileName(null); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.txt,.md,.csv,.json" onChange={handleFileSelect} />
          <Button variant="ghost" size="icon" className="h-[44px] w-[44px] flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isLoading} title={t("chat.fileUpload")}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant={isRecording ? "destructive" : "ghost"} size="icon" className="h-[44px] w-[44px] flex-shrink-0" onClick={isRecording ? stopRecording : startRecording} disabled={isLoading} title={isRecording ? t("chat.recording") : t("chat.voiceInput")}>
            {isRecording ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("chat.placeholder")} className="min-h-[44px] max-h-[200px] resize-none" rows={1} disabled={isLoading} />
          <Button onClick={handleSend} disabled={(!input.trim() && !attachedImage) || isLoading} size="icon" className="h-[44px] w-[44px] flex-shrink-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">{t("chat.disclaimer")}</p>
      </div>
    </div>
  );
}
