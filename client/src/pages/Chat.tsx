import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Send, Plus, Trash2, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  messages?: Message[];
}

const typingDotsStyle = `
@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
`;

export default function Chat() {
  const [activeConvo, setActiveConvo] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: activeConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", activeConvo],
    enabled: !!activeConvo,
  });

  const messages = activeConversation?.messages || [];

  const createConvo = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/conversations", { title: "New Chat" });
      return res.json();
    },
    onSuccess: (data: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConvo(data.id);
    },
  });

  const deleteConvo = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConvo) setActiveConvo(null);
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    let convoId = activeConvo;
    if (!convoId) {
      const res = await apiRequest("POST", "/api/conversations", {
        title: input.slice(0, 50) || "New Chat",
      });
      const newConvo = await res.json();
      convoId = newConvo.id;
      setActiveConvo(convoId);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }

    const messageText = input;
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    queryClient.invalidateQueries({ queryKey: ["/api/conversations", convoId] });

    try {
      const response = await fetch(`/api/conversations/${convoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulated += data.content;
                setStreamingContent(accumulated);
              }
              if (data.done) {
                setStreamingContent("");
                setIsStreaming(false);
                queryClient.invalidateQueries({ queryKey: ["/api/conversations", convoId] });
                queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, isStreaming, activeConvo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full">
      <style>{typingDotsStyle}</style>
      <div className="w-[260px] border-r border-border bg-muted/50 flex flex-col shrink-0">
        <Button variant="outline" className="m-3" onClick={() => createConvo.mutate()}>
          <Plus size={16} />
          New Chat
        </Button>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors",
                activeConvo === c.id && "bg-accent text-accent-foreground"
              )}
              onClick={() => setActiveConvo(c.id)}
            >
              <MessageSquare size={14} className="shrink-0" />
              <span className="truncate flex-1">{c.title}</span>
              <button
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1"
                onClick={(e) => { e.stopPropagation(); deleteConvo.mutate(c.id); }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeConvo && messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare size={32} />
            </div>
            <h2 className="text-xl font-semibold text-foreground">How can I help you today?</h2>
            <p className="text-sm">Start a conversation or select one from the sidebar</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 mb-4 max-w-3xl",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {msg.role === "user" ? "You" : "AI"}
                </div>
                <div
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-muted text-foreground"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {streamingContent && (
              <div className="flex gap-3 mb-4 max-w-3xl mr-auto">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-muted text-muted-foreground">
                  AI
                </div>
                <div className="rounded-xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap bg-muted text-foreground">
                  {streamingContent}
                </div>
              </div>
            )}
            {isStreaming && !streamingContent && (
              <div className="flex gap-3 mb-4 max-w-3xl mr-auto">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-muted text-muted-foreground">
                  AI
                </div>
                <div className="rounded-xl px-4 py-2.5 bg-muted flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" style={{ animation: "typingBounce 1.4s infinite ease-in-out", animationDelay: "0s" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" style={{ animation: "typingBounce 1.4s infinite ease-in-out", animationDelay: "0.2s" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" style={{ animation: "typingBounce 1.4s infinite ease-in-out", animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Send a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
