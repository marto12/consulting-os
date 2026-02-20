import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Bot,
  Workflow,
  ChevronDown,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "../lib/utils";

interface Agent {
  id: number;
  key: string;
  name: string;
  description: string;
}

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
  agentName?: string;
  timestamp?: number;
}

interface EditorChatPanelProps {
  editorType: "document" | "slides";
  editorId: number;
  getContentFn: () => string;
  onInsertContent?: (text: string) => void;
  className?: string;
}

const typingDotsStyle = `
@keyframes editorChatBounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
`;

export default function EditorChatPanel({
  editorType,
  editorId,
  getContentFn,
  onInsertContent,
  className,
}: EditorChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("general");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: workflows = [] } = useQuery<WorkflowTemplate[]>({
    queryKey: ["/api/workflow-templates"],
  });

  const docAgents = useMemo(
    () => agents.filter((a) => a.key.startsWith("doc_")),
    [agents]
  );

  const workflowAgents = useMemo(
    () => agents.filter((a) => !a.key.startsWith("doc_")),
    [agents]
  );

  const selectedLabel = useMemo(() => {
    if (selectedMode === "general") return "General Assistant";
    if (selectedMode.startsWith("workflow:")) {
      const wf = workflows.find(
        (w) => w.id === Number(selectedMode.split(":")[1])
      );
      return wf ? wf.name : "Workflow";
    }
    const agent = agents.find((a) => a.key === selectedMode);
    return agent ? agent.name : selectedMode;
  }, [selectedMode, agents, workflows]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, statusMessage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const writeToDoc = editorType === "document" && !!onInsertContent;

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const messageText = input;
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setStatusMessage("");

    const content = getContentFn();

    const history = messages
      .filter((m) => m.role !== "status")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/editor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorType,
          editorId,
          mode: selectedMode,
          message: messageText,
          editorContent: content,
          history,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";
      let currentAgentName = "";

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
                if (data.agentName) currentAgentName = data.agentName;
              }
              if (data.workflowStep) {
                if (accumulated.trim()) {
                  if (writeToDoc) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: Date.now().toString() + "_step_note",
                        role: "status",
                        content: `${currentAgentName || "Agent"} wrote to document`,
                      },
                    ]);
                  } else {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: Date.now().toString() + "_step",
                        role: "assistant",
                        content: accumulated.trim(),
                        agentName: currentAgentName,
                      },
                    ]);
                  }
                  accumulated = "";
                  setStreamingContent("");
                }
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString() + "_ws",
                    role: "status",
                    content: data.workflowStep,
                  },
                ]);
              }
              if (data.content) {
                setStatusMessage("");
                if (writeToDoc) {
                  onInsertContent!(data.content);
                  accumulated += data.content;
                  setStatusMessage(`Writing to document...`);
                } else {
                  accumulated += data.content;
                  setStreamingContent(accumulated);
                }
              }
              if (data.error) {
                setStatusMessage("");
                accumulated += data.error;
                setStreamingContent(accumulated);
              }
              if (data.done) {
                if (writeToDoc) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: Date.now().toString() + "_done",
                      role: "status",
                      content: `${currentAgentName || "AI"} finished writing to document`,
                    },
                  ]);
                } else if (accumulated.trim()) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: Date.now().toString() + "_done",
                      role: "assistant",
                      content: accumulated.trim(),
                      agentName: currentAgentName || undefined,
                    },
                  ]);
                }
                setStreamingContent("");
                setStatusMessage("");
                setIsStreaming(false);
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error("Editor chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
      setIsStreaming(false);
      setStreamingContent("");
      setStatusMessage("");
    }
  }, [input, isStreaming, selectedMode, editorType, editorId, getContentFn, messages, writeToDoc, onInsertContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-40 flex items-center gap-2 shadow-lg hover:bg-primary/90 transition-all bg-primary text-primary-foreground",
          "right-4 bottom-4 px-4 py-2.5 rounded-full",
          "md:right-4 md:bottom-4 md:px-4 md:py-2.5 md:rounded-full",
          className
        )}
      >
        <MessageSquare size={18} />
        <span className="text-sm font-medium">AI Chat</span>
      </button>
    );
  }

  return (
    <>
      <style>{typingDotsStyle}</style>
      <div
        className="fixed inset-0 bg-black/20 z-30 md:hidden"
        onClick={() => setOpen(false)}
      />
      <div
        className={cn(
          "fixed z-40 bg-background border-border flex flex-col shadow-2xl",
          "inset-x-0 bottom-0 h-[60vh] border-t rounded-t-xl",
          "md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:h-auto md:w-[380px] md:border-l md:border-t-0 md:rounded-none",
          className
        )}
      >
        {/* Header */}
        <div className="h-12 border-b flex items-center gap-2 px-3 shrink-0 bg-muted/30 md:rounded-none rounded-t-xl">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30 absolute top-2 left-1/2 -translate-x-1/2 md:hidden" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setOpen(false)}
          >
            <ChevronRight size={16} className="hidden md:block" />
            <ChevronDown size={16} className="md:hidden" />
          </Button>
          <div className="relative flex-1" ref={dropdownRef}>
            <button
              className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors w-full"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {selectedMode === "general" ? (
                <Bot size={14} />
              ) : selectedMode.startsWith("workflow:") ? (
                <Workflow size={14} />
              ) : (
                <Sparkles size={14} />
              )}
              <span className="truncate">{selectedLabel}</span>
              <ChevronDown
                size={12}
                className={cn(
                  "shrink-0 transition-transform",
                  dropdownOpen && "rotate-180"
                )}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden max-h-[400px] overflow-y-auto">
                <div className="p-1">
                  <button
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                      selectedMode === "general" && "bg-accent"
                    )}
                    onClick={() => {
                      setSelectedMode("general");
                      setDropdownOpen(false);
                    }}
                  >
                    <Bot size={14} className="shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-medium">General Assistant</div>
                      <div className="text-xs text-muted-foreground truncate">
                        General-purpose AI with document context
                      </div>
                    </div>
                  </button>
                </div>

                {docAgents.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-t">
                      Document Agents
                    </div>
                    <div className="p-1">
                      {docAgents.map((agent) => (
                        <button
                          key={agent.key}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                            selectedMode === agent.key && "bg-accent"
                          )}
                          onClick={() => {
                            setSelectedMode(agent.key);
                            setDropdownOpen(false);
                          }}
                        >
                          <Sparkles
                            size={14}
                            className="shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0">
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {agent.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {workflowAgents.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-t">
                      Consulting Agents
                    </div>
                    <div className="p-1">
                      {workflowAgents.map((agent) => (
                        <button
                          key={agent.key}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                            selectedMode === agent.key && "bg-accent"
                          )}
                          onClick={() => {
                            setSelectedMode(agent.key);
                            setDropdownOpen(false);
                          }}
                        >
                          <Sparkles
                            size={14}
                            className="shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0">
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {agent.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {workflows.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-t">
                      Workflows
                    </div>
                    <div className="p-1">
                      {workflows.map((wf) => (
                        <button
                          key={wf.id}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                            selectedMode === `workflow:${wf.id}` && "bg-accent"
                          )}
                          onClick={() => {
                            setSelectedMode(`workflow:${wf.id}`);
                            setDropdownOpen(false);
                          }}
                        >
                          <Workflow
                            size={14}
                            className="shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0">
                            <div className="font-medium">{wf.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {wf.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setMessages([])}
            title="Clear chat"
          >
            <X size={14} />
          </Button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <MessageSquare size={28} className="opacity-50" />
              <p className="text-sm text-center">
                Ask anything about your{" "}
                {editorType === "document" ? "document" : "slides"}
              </p>
              <p className="text-xs text-center opacity-60">
                {writeToDoc
                  ? "AI responses will be written directly into your document"
                  : "The AI has access to your current content"}
              </p>
            </div>
          )}

          {messages.map((msg) =>
            msg.role === "status" ? (
              <div
                key={msg.id}
                className="flex items-center gap-2 text-xs text-muted-foreground px-2"
              >
                <div className="h-px flex-1 bg-border" />
                <Workflow size={10} />
                <span>{msg.content}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            ) : (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {msg.role === "user" ? "You" : "AI"}
                </div>
                <div className="flex flex-col gap-0.5 max-w-[85%]">
                  {msg.agentName && (
                    <span className="text-[10px] text-muted-foreground font-medium px-1">
                      {msg.agentName}
                    </span>
                  )}
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          )}

          {isStreaming && statusMessage && !streamingContent && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                <Sparkles size={12} className="animate-pulse" />
              </div>
              <div className="rounded-xl px-3 py-2 text-sm bg-muted/50 text-muted-foreground flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                {statusMessage}
              </div>
            </div>
          )}

          {streamingContent && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground text-[10px] font-semibold">
                AI
              </div>
              <div className="rounded-xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap bg-muted text-foreground">
                {streamingContent}
                <span className="inline-block w-1.5 h-3.5 bg-foreground/40 animate-pulse ml-0.5 align-text-bottom" />
              </div>
            </div>
          )}

          {isStreaming && !streamingContent && !statusMessage && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground text-[10px] font-semibold">
                AI
              </div>
              <div className="rounded-xl px-3 py-2 bg-muted flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                  style={{
                    animation:
                      "editorChatBounce 1.4s infinite ease-in-out",
                    animationDelay: "0s",
                  }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                  style={{
                    animation:
                      "editorChatBounce 1.4s infinite ease-in-out",
                    animationDelay: "0.2s",
                  }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                  style={{
                    animation:
                      "editorChatBounce 1.4s infinite ease-in-out",
                    animationDelay: "0.4s",
                  }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              className="flex-1 resize-none min-h-[38px] max-h-[120px] text-sm"
              placeholder={`Ask about your ${editorType === "document" ? "document" : "slides"}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
