import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import AIChatBox from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDate, truncate } from "@/lib/utils";

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();

  const {
    data: conversations,
    isLoading: loadingConversations,
    refetch: refetchConversations,
  } = trpc.conversations.list.useQuery();

  const { data: agents } = trpc.agents.list.useQuery();

  const deleteConversation = trpc.conversations.delete.useMutation({
    onSuccess: () => {
      refetchConversations();
      if (conversationId) {
        navigate("/chat");
      }
    },
  });

  const currentConvId = conversationId ? parseInt(conversationId) : undefined;

  const handleConversationCreated = (id: number) => {
    navigate(`/chat/${id}`);
    refetchConversations();
  };

  const handleNewChat = () => {
    navigate("/chat");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Conversation sidebar */}
      <div className="w-72 border-r flex flex-col bg-card hidden md:flex">
        <div className="p-3 border-b">
          <Button onClick={handleNewChat} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Agent selector */}
        <div className="p-3 border-b">
          <select
            value={selectedAgent || ""}
            onChange={(e) => setSelectedAgent(e.target.value || undefined)}
            className="w-full text-sm bg-background border rounded-md px-2 py-1.5"
          >
            <option value="">Default Agent</option>
            {agents?.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">
                No conversations yet. Start a new chat!
              </p>
            ) : (
              conversations?.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
                    currentConvId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent text-foreground"
                  )}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {truncate(conv.title, 30)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(conv.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation.mutate({ id: conv.id });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1">
        <AIChatBox
          conversationId={currentConvId}
          agentId={selectedAgent}
          onConversationCreated={handleConversationCreated}
          className="h-full border-0 rounded-none"
        />
      </div>
    </div>
  );
}
