import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Send, Plus, Trash2, MessageSquare } from "lucide-react";
import "./Chat.css";

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
    <div className="chat-page">
      <div className="chat-sidebar">
        <button className="chat-new-btn" onClick={() => createConvo.mutate()}>
          <Plus size={16} />
          New Chat
        </button>
        <div className="chat-convo-list">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`chat-convo-item${activeConvo === c.id ? " active" : ""}`}
              onClick={() => setActiveConvo(c.id)}
            >
              <MessageSquare size={14} />
              <span className="chat-convo-title">{c.title}</span>
              <button
                className="chat-convo-delete"
                onClick={(e) => { e.stopPropagation(); deleteConvo.mutate(c.id); }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        {!activeConvo && messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <MessageSquare size={40} />
            </div>
            <h2>How can I help you today?</h2>
            <p>Start a conversation or select one from the sidebar</p>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-msg ${msg.role}`}>
                <div className="chat-msg-avatar">
                  {msg.role === "user" ? "You" : "AI"}
                </div>
                <div className="chat-msg-content">
                  <div className="chat-msg-text">{msg.content}</div>
                </div>
              </div>
            ))}
            {streamingContent && (
              <div className="chat-msg assistant">
                <div className="chat-msg-avatar">AI</div>
                <div className="chat-msg-content">
                  <div className="chat-msg-text">{streamingContent}</div>
                </div>
              </div>
            )}
            {isStreaming && !streamingContent && (
              <div className="chat-msg assistant">
                <div className="chat-msg-avatar">AI</div>
                <div className="chat-msg-content">
                  <div className="chat-msg-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Send a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
            />
            <button
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
