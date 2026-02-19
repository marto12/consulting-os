import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Send, Plus, Trash2, MessageSquare, Loader2, Sparkles, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Textarea } from "../components/ui/textarea";
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
  const [statusMessage, setStatusMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  }, [messages, streamingContent, statusMessage, scrollToBottom]);

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
    setStatusMessage("");

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
              if (data.status) {
                setStatusMessage(data.message || data.status);
              }
              if (data.content) {
                setStatusMessage("");
                accumulated += data.content;
                setStreamingContent(accumulated);
              }
              if (data.error) {
                setStatusMessage("");
                setStreamingContent(accumulated || "An error occurred. Please try again.");
              }
              if (data.done) {
                setStreamingContent("");
                setStatusMessage("");
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
      setStatusMessage("");
    }
  }, [input, isStreaming, activeConvo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full relative">
      <style>{typingDotsStyle}</style>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "border-r border-border bg-muted/50 flex flex-col shrink-0 z-40 transition-transform duration-200",
          "fixed inset-y-0 left-0 w-[280px] md:relative md:w-[260px] md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 m-3">
          <Button variant="outline" className="flex-1" onClick={() => createConvo.mutate()}>
            <Plus size={16} />
            New Chat
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose size={18} />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors",
                activeConvo === c.id && "bg-accent text-accent-foreground"
              )}
              onClick={() => { setActiveConvo(c.id); setSidebarOpen(false); }}
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
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!activeConvo && messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground px-4">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 left-3 md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeftOpen size={20} />
            </Button>
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare size={32} />
            </div>
            <h2 className="text-xl font-semibold text-foreground text-center">How can I help you today?</h2>
            <p className="text-sm text-center">Start a conversation or select one from the sidebar</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 left-1 md:hidden z-10"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeftOpen size={20} />
            </Button>
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
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {msg.role === "user" ? "You" : "AI"}
                </div>
                <div
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isStreaming && statusMessage && !streamingContent && (
              <div className="flex gap-3 mb-4 max-w-3xl mr-auto">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-muted text-muted-foreground">
                  <Sparkles size={14} className="animate-pulse" />
                </div>
                <div className="rounded-xl px-4 py-2.5 text-sm bg-muted/50 text-muted-foreground flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {statusMessage}
                </div>
              </div>
            )}
            {streamingContent && (
              <div className="flex gap-3 mb-4 max-w-3xl mr-auto">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-muted text-muted-foreground">
                  AI
                </div>
                <div className="rounded-xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap bg-muted text-foreground">
                  {streamingContent}
                  <span className="inline-block w-2 h-4 bg-foreground/40 animate-pulse ml-0.5 align-text-bottom" />
                </div>
              </div>
            )}
            {isStreaming && !streamingContent && !statusMessage && (
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

        <div className="border-t border-border p-3 md:p-4">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <Textarea
              ref={inputRef}
              className="flex-1 resize-none min-h-[40px]"
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
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
