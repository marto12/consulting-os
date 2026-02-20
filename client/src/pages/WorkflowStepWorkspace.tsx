import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import {
  ChevronLeft,
  Bot,
  FileText,
  Send,
  PlayCircle,
  Check,
  CheckCircle,
  Loader2,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  AlertCircle,
  Sparkles,
  User,
  Code,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";
import DeliverablePreview from "../components/DeliverablePreview";

const AGENT_COLORS: Record<string, string> = {
  project_definition: "#6B7280",
  issues_tree: "#6B7280",
  mece_critic: "#9CA3AF",
  hypothesis: "#6B7280",
  execution: "#6B7280",
  summary: "#9CA3AF",
  presentation: "#6B7280",
};

function formatDeliverableText(agentKey: string, content: any): string {
  if (!content) return "No content generated.";

  try {
    if (agentKey === "project_definition") {
      const lines: string[] = [];
      if (content.decision_statement) lines.push(`**Decision Statement**\n${content.decision_statement}`);
      if (content.governing_question) lines.push(`**Governing Question**\n${content.governing_question}`);
      if (content.decision_owner) lines.push(`**Decision Owner:** ${content.decision_owner}`);
      if (content.decision_deadline) lines.push(`**Decision Deadline:** ${content.decision_deadline}`);
      if (content.success_metrics?.length) {
        lines.push(`**Success Metrics**`);
        content.success_metrics.forEach((m: any) => {
          lines.push(`  - ${m.metric_name}: ${m.definition} (Target: ${m.threshold_or_target})`);
        });
      }
      if (content.alternatives?.length) {
        lines.push(`**Alternatives**`);
        content.alternatives.forEach((a: string) => lines.push(`  - ${a}`));
      }
      if (content.constraints) {
        lines.push(`**Constraints**`);
        Object.entries(content.constraints).forEach(([k, v]) => {
          if (v) lines.push(`  - ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
        });
      }
      if (content.assumptions?.length) {
        lines.push(`**Assumptions**`);
        content.assumptions.forEach((a: string) => lines.push(`  - ${a}`));
      }
      if (content.initial_hypothesis) lines.push(`**Initial Hypothesis**\n${content.initial_hypothesis}`);
      if (content.key_uncertainties?.length) {
        lines.push(`**Key Uncertainties**`);
        content.key_uncertainties.forEach((u: string) => lines.push(`  - ${u}`));
      }
      if (content.information_gaps?.length) {
        lines.push(`**Information Gaps**`);
        content.information_gaps.forEach((g: string) => lines.push(`  - ${g}`));
      }
      return lines.join("\n\n");
    }

    if (agentKey === "issues_tree") {
      const issues = content.issues || [];
      const criticLog = content.criticLog || [];
      const roots = issues.filter((n: any) => !n.parentId);

      function renderBranch(parentId: string | null, indent: number): string {
        const children = issues.filter((n: any) => n.parentId === parentId);
        return children.map((c: any) => {
          const prefix = "  ".repeat(indent) + "- ";
          const priority = c.priority ? ` [${c.priority}]` : "";
          const line = `${prefix}${c.text}${priority}`;
          const sub = renderBranch(c.id, indent + 1);
          return sub ? `${line}\n${sub}` : line;
        }).join("\n");
      }

      const lines: string[] = [];
      lines.push(`**Issues Tree** (${issues.length} nodes, ${roots.length} root branches)`);
      lines.push(renderBranch(null, 0));

      if (criticLog.length > 0) {
        const lastCritic = criticLog[criticLog.length - 1]?.critic;
        if (lastCritic) {
          lines.push(`\n**MECE Quality Score:** ${lastCritic.overallScore}/5 - ${lastCritic.verdict === "approved" ? "Approved" : "Needs revision"}`);
        }
      }
      return lines.join("\n\n");
    }

    if (agentKey === "hypothesis") {
      const lines: string[] = [];
      if (content.hypotheses?.length) {
        lines.push(`**Hypotheses** (${content.hypotheses.length} generated)`);
        content.hypotheses.forEach((h: any, i: number) => {
          lines.push(`${i + 1}. ${h.statement}`);
          lines.push(`   Metric: ${h.metric} | Data Source: ${h.dataSource} | Method: ${h.method}`);
        });
      }
      if (content.analysisPlan?.length) {
        lines.push(`\n**Analysis Plan** (${content.analysisPlan.length} analyses)`);
        content.analysisPlan.forEach((p: any, i: number) => {
          lines.push(`${i + 1}. Method: ${p.method}`);
          if (p.requiredDataset) lines.push(`   Required Dataset: ${p.requiredDataset}`);
        });
      }
      return lines.join("\n");
    }

    if (agentKey === "execution") {
      if (Array.isArray(content)) {
        const lines: string[] = [`**Scenario Analysis Results** (${content.length} scenarios)`];
        content.forEach((r: any, i: number) => {
          lines.push(`\nScenario ${i + 1}: ${r.toolName || "Analysis"}`);
          if (r.outputs?.summary) {
            const s = r.outputs.summary;
            lines.push(`  Expected NPV: $${s.expectedValue?.toLocaleString() || "N/A"}`);
            lines.push(`  Best Case: $${s.optimisticNpv?.toLocaleString() || "N/A"}`);
            lines.push(`  Worst Case: $${s.pessimisticNpv?.toLocaleString() || "N/A"}`);
            lines.push(`  Risk-Adjusted Return: ${s.riskAdjustedReturn || "N/A"}%`);
          }
          if (r.inputs) {
            lines.push(`  Baseline Revenue: $${r.inputs.baselineRevenue?.toLocaleString() || "N/A"}`);
            lines.push(`  Growth Rate: ${((r.inputs.growthRate || 0) * 100).toFixed(1)}%`);
          }
        });
        return lines.join("\n");
      }
    }

    if (agentKey === "summary") {
      if (content.summaryText) {
        return content.summaryText;
      }
    }

    if (agentKey === "presentation") {
      if (content.slides?.length) {
        const lines: string[] = [`**Presentation Deck** (${content.slides.length} slides)`];
        content.slides.forEach((s: any) => {
          const slideNum = (s.slideIndex ?? 0) + 1;
          lines.push(`\nSlide ${slideNum}: ${s.title}`);
          if (s.subtitle) lines.push(`  ${s.subtitle}`);
          if (s.layout) lines.push(`  Layout: ${s.layout}`);
          if (s.bodyJson?.bullets) {
            s.bodyJson.bullets.forEach((b: string) => lines.push(`  - ${b}`));
          }
          if (s.bodyJson?.metrics) {
            s.bodyJson.metrics.forEach((m: any) => lines.push(`  - ${m.label}: ${m.value} (${m.change})`));
          }
        });
        return lines.join("\n");
      }
    }

    if (typeof content === "string") return content;
    return JSON.stringify(content, null, 2);
  } catch {
    return typeof content === "string" ? content : JSON.stringify(content, null, 2);
  }
}

interface ChatMessage {
  id?: number;
  role: string;
  content: string;
  messageType: string;
  metadata?: any;
  createdAt?: string;
  isStreaming?: boolean;
}

interface StepData {
  step: {
    id: number;
    workflowInstanceId: number;
    stepOrder: number;
    name: string;
    agentKey: string;
    status: string;
    outputSummary: any;
    configJson?: any;
  };
  deliverables: {
    id: number;
    title: string;
    contentJson: any;
    version: number;
    locked: boolean;
    createdAt: string;
  }[];
}

function JsonToggle({ content }: { content: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Code size={12} />
        <span>{expanded ? "Hide" : "Show"} raw data</span>
      </button>
      {expanded && (
        <div className="bg-muted rounded-lg p-3 mt-2 text-sm font-mono overflow-auto max-h-[300px] max-w-full">
          <pre className="whitespace-pre-wrap text-xs break-words">
            {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed break-words overflow-hidden" style={{ wordBreak: "break-word" }}>
      {text.split("\n").map((line, i) => {
        if (line.match(/^\*\*.*\*\*$/)) {
          return <p key={i} className="font-semibold text-foreground mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
        }
        if (line.match(/^\*\*.*:\*\*\s/)) {
          const parts = line.match(/^\*\*(.*?):\*\*\s*(.*)/);
          if (parts) {
            return <p key={i} className="mt-1"><span className="font-semibold text-foreground">{parts[1]}:</span> {parts[2]}</p>;
          }
        }
        if (line.match(/^\*\*.*\*\*\s/)) {
          const parts = line.match(/^\*\*(.*?)\*\*\s*(.*)/);
          if (parts) {
            return <p key={i} className="mt-2"><span className="font-semibold text-foreground">{parts[1]}</span> {parts[2]}</p>;
          }
        }
        if (line.match(/^\*\*.*\*\*/)) {
          const cleaned = line.replace(/\*\*/g, "");
          return <p key={i} className="font-semibold text-foreground mt-3 mb-1">{cleaned}</p>;
        }
        if (line.trim().startsWith("- ")) {
          const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
          return <p key={i} className="text-muted-foreground" style={{ paddingLeft: `${Math.max(indent * 4, 8)}px` }}>{line.trim()}</p>;
        }
        if (line.match(/^\d+\.\s/)) {
          return <p key={i} className="text-foreground mt-1">{line}</p>;
        }
        if (line.match(/^\s{2,}/)) {
          return <p key={i} className="text-muted-foreground pl-4">{line.trim()}</p>;
        }
        if (line.startsWith("#")) {
          const cleaned = line.replace(/^#+\s*/, "");
          return <p key={i} className="font-semibold text-foreground mt-3 mb-1 text-base">{cleaned}</p>;
        }
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} className="text-foreground">{line}</p>;
      })}
    </div>
  );
}

export default function WorkflowStepWorkspace() {
  const { id, stepId } = useParams<{ id: string; stepId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = Number(id);
  const stepIdNum = Number(stepId);
  const [showPanel, setShowPanel] = useState(window.innerWidth >= 640);
  const [chatInput, setChatInput] = useState("");
  const [streamMessages, setStreamMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autorunTriggered, setAutorunTriggered] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ agentKey: string; content: any; title: string } | null>(null);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatStreamTokens, setChatStreamTokens] = useState("");
  const [confirmSideA, setConfirmSideA] = useState("");
  const [confirmSideB, setConfirmSideB] = useState("");
  const [confirmInitialized, setConfirmInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: project } = useQuery<any>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: stepData, isLoading } = useQuery<StepData>({
    queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum],
    refetchInterval: isStreaming ? false : 5000,
  });

  const { data: chatHistory } = useQuery<ChatMessage[]>({
    queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum, "chat"],
    refetchInterval: isStreaming ? false : 5000,
  });

  const { data: agentInfo } = useQuery<any>({
    queryKey: ["/api/agents/detail", stepData?.step?.agentKey],
    enabled: !!stepData?.step?.agentKey,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamMessages, chatHistory, chatStreamTokens]);

  const startStreaming = useCallback(() => {
    setIsStreaming(true);
    setStreamMessages([]);

    const eventSource = new EventSource(
      `/api/projects/${projectId}/workflow/steps/${stepIdNum}/run-stream`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          setStreamMessages([{
            role: "assistant",
            content: "Agent connected. Starting execution...",
            messageType: "status",
            isStreaming: true,
          }]);
          return;
        }

        if (data.type === "progress") {
          setStreamMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.content,
              messageType: "progress",
              isStreaming: true,
            },
          ]);
          return;
        }

        if (data.type === "complete") {
          setStreamMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Done.",
              messageType: "complete",
            },
          ]);
          setIsStreaming(false);
          eventSource.close();
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum, "chat"] });
          return;
        }

        if (data.type === "error") {
          setStreamMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Error: ${data.content}`,
              messageType: "error",
            },
          ]);
          setIsStreaming(false);
          eventSource.close();
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
          return;
        }
      } catch {}
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum, "chat"] });
    };

    return () => {
      eventSource.close();
    };
  }, [projectId, stepIdNum]);

  useEffect(() => {
    if (searchParams.get("autorun") === "true" && !autorunTriggered && !isStreaming && stepData) {
      const canAutoRun = stepData.step.status === "not_started" || stepData.step.status === "failed";
      if (canAutoRun) {
        setAutorunTriggered(true);
        setSearchParams({}, { replace: true });
        startStreaming();
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, autorunTriggered, isStreaming, stepData, startStreaming, setSearchParams]);

  const sendChatStreaming = useCallback(async (message: string) => {
    setChatStreaming(true);
    setChatStreamTokens("");

    setStreamMessages((prev) => [
      ...prev,
      { role: "user", content: message, messageType: "message" },
    ]);

    try {
      const response = await fetch(`/api/projects/${projectId}/workflow/steps/${stepIdNum}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        setChatStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let tokenBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "connected") {
              setStreamMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Processing your feedback...", messageType: "status", isStreaming: true },
              ]);
            } else if (data.type === "progress" || data.type === "llm" || data.type === "critic") {
              setStreamMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.content, messageType: "progress", isStreaming: true },
              ]);
            } else if (data.type === "token") {
              tokenBuffer += data.content;
              setChatStreamTokens(tokenBuffer);
            } else if (data.type === "complete") {
              setChatStreamTokens("");
              setChatStreaming(false);
              setStreamMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Refinement complete.", messageType: "complete" },
              ]);
              queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum, "chat"] });
              queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
            } else if (data.type === "error") {
              setChatStreamTokens("");
              setChatStreaming(false);
              setStreamMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${data.content}`, messageType: "error" },
              ]);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error("Chat stream error:", err);
      setChatStreaming(false);
      setChatStreamTokens("");
      setStreamMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again.", messageType: "error" },
      ]);
    }

    setChatStreaming(false);
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum, "chat"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
  }, [projectId, stepIdNum]);

  const approveStepMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflow/steps/${stepIdNum}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
    },
  });

  const unapproveStepMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflow/steps/${stepIdNum}/unapprove`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum, "chat"] });
    },
  });

  const confirmPositionsMutation = useMutation({
    mutationFn: async ({ sideA, sideB }: { sideA: string; sideB: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflow/steps/${stepIdNum}/confirm-positions`, { sideA, sideB });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum, "chat"] });
    },
  });

  useEffect(() => {
    if (stepData?.step?.status === "awaiting_confirmation" && stepData.step.configJson && !confirmInitialized) {
      const cfg = stepData.step.configJson as any;
      setConfirmSideA(cfg.extractedSideA || "");
      setConfirmSideB(cfg.extractedSideB || "");
      setConfirmInitialized(true);
    }
  }, [stepData, confirmInitialized]);

  const handleSend = () => {
    const msg = chatInput.trim();
    if (!msg || chatStreaming || isStreaming) return;
    setChatInput("");
    sendChatStreaming(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading || !stepData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { step, deliverables } = stepData;
  const agentColor = AGENT_COLORS[step.agentKey] || "#6B7280";
  const canRun = step.status === "not_started" || step.status === "failed";
  const canApprove = step.status === "completed";
  const isApproved = step.status === "approved";
  const isAwaitingConfirmation = step.status === "awaiting_confirmation";
  const hasHistory = (chatHistory && chatHistory.length > 0) || streamMessages.length > 0;

  const allMessages: ChatMessage[] = [
    ...(chatHistory || []),
    ...streamMessages,
  ];

  function renderMessageIcon(msg: ChatMessage) {
    if (msg.role === "user") {
      return (
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <User size={14} className="text-primary" />
        </div>
      );
    }
    if (msg.messageType === "deliverable") {
      return (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: agentColor + "20" }}
        >
          <FileText size={14} style={{ color: agentColor }} />
        </div>
      );
    }
    return (
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: agentColor + "20" }}
      >
        {msg.messageType === "error" ? (
          <AlertCircle size={14} className="text-destructive" />
        ) : msg.messageType === "complete" ? (
          <CheckCircle size={14} style={{ color: agentColor }} />
        ) : (
          <Bot size={14} style={{ color: agentColor }} />
        )}
      </div>
    );
  }

  function renderDeliverableInline(msg: ChatMessage) {
    let contentJson: any;
    try {
      contentJson = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
    } catch {
      contentJson = msg.content;
    }

    const agentKey = msg.metadata?.agentKey || step.agentKey;
    const text = formatDeliverableText(agentKey, contentJson);
    const title = msg.metadata?.title || step.name;

    const openPreview = () => {
      setPreviewData({ agentKey, content: contentJson, title });
      setPreviewOpen(true);
    };

    return (
      <div className="flex-1 min-w-0 pt-0.5">
        <Card className="p-3 sm:p-4 overflow-hidden border-l-2" style={{ borderLeftColor: agentColor }}>
          <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">{title}</span>
              {msg.metadata?.version && (
                <Badge variant="default" className="text-[10px] shrink-0">v{msg.metadata.version}</Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openPreview}
              className="shrink-0 text-xs h-7 px-2.5 gap-1.5"
            >
              <Eye size={13} />
              Preview
            </Button>
          </div>
          <FormattedText text={text} />
          {isApproved && <JsonToggle content={contentJson} />}
        </Card>
      </div>
    );
  }

  function renderMessageContent(msg: ChatMessage) {
    const isProgress = msg.messageType === "progress" || msg.messageType === "status";
    const isComplete = msg.messageType === "complete";
    const isError = msg.messageType === "error";

    return (
      <div
        className={cn(
          "text-sm leading-relaxed break-words",
          isProgress && "text-muted-foreground",
          isComplete && "text-foreground font-medium",
          isError && "text-destructive font-medium",
          msg.role === "user" && "text-foreground"
        )}
        style={{ wordBreak: "break-word" }}
      >
        {msg.content}
        {msg.isStreaming && isProgress && (
          <span className="inline-block ml-1 animate-pulse">...</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex shrink-0 items-center gap-2 border-b px-2 sm:px-4 h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4 hidden sm:block" />
        <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)} className="shrink-0 sm:hidden h-8 w-8">
          <ChevronLeft size={16} />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}`)} className="shrink-0 hidden sm:flex">
          <ChevronLeft size={16} />
          {project?.name || "Project"}
        </Button>
        <Separator orientation="vertical" className="h-4 hidden sm:block" />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Bot size={16} style={{ color: agentColor }} className="shrink-0" />
          <span className="font-semibold text-sm truncate">{step.name}</span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline-block"
            style={{ backgroundColor: agentColor + "20", color: agentColor }}
          >
            Step {step.stepOrder}
          </span>
          <Badge
            variant={
              step.status === "approved" ? "success" :
              step.status === "completed" ? "success" :
              step.status === "running" ? "default" :
              step.status === "awaiting_confirmation" ? "outline" :
              step.status === "failed" ? "destructive" : "default"
            }
            className="text-[10px] sm:text-xs shrink-0"
          >
            {isStreaming ? "running" : step.status === "awaiting_confirmation" ? "needs confirmation" : step.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {canRun && !isStreaming && (
            <Button size="sm" onClick={startStreaming} className="h-8 px-2 sm:px-3">
              <PlayCircle size={14} /> <span className="hidden sm:inline">Run</span>
            </Button>
          )}
          {isStreaming && (
            <Button size="sm" disabled className="h-8 px-2 sm:px-3">
              <Loader2 className="h-4 w-4 animate-spin" /> <span className="hidden sm:inline">Running</span>
            </Button>
          )}
          {canApprove && (
            <Button size="sm" variant="outline" onClick={() => approveStepMutation.mutate()} disabled={approveStepMutation.isPending} className="h-8 px-2 sm:px-3">
              {approveStepMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check size={14} /> <span className="hidden sm:inline">Approve</span></>}
            </Button>
          )}
          {isApproved && (
            <Button size="sm" variant="outline" onClick={() => unapproveStepMutation.mutate()} disabled={unapproveStepMutation.isPending} className="h-8 px-2 sm:px-3">
              {unapproveStepMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw size={14} /> <span className="hidden sm:inline">Unapprove</span></>}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowPanel(!showPanel)}
            className="hidden sm:flex"
          >
            {showPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
            {!hasHistory && step.status === "not_started" && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: agentColor + "15" }}>
                  <Sparkles size={32} style={{ color: agentColor }} />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Ready to Run</h2>
                <p className="text-sm text-center max-w-md">
                  Click "Run" to execute the {step.name} agent. Progress will stream here in real-time.
                </p>
                <Button onClick={startStreaming} className="mt-2">
                  <PlayCircle size={16} /> Run {step.name}
                </Button>
              </div>
            )}

            {!hasHistory && step.status === "failed" && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <AlertCircle size={24} className="text-destructive" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Step Failed</h2>
                <p className="text-sm text-muted-foreground">The agent encountered an error. You can retry.</p>
                <Button onClick={startStreaming} variant="outline" className="mt-2">
                  <PlayCircle size={16} /> Retry
                </Button>
              </div>
            )}

            {hasHistory && (
              <div className="max-w-3xl mx-auto space-y-4">
                {allMessages.map((msg, i) => (
                  <div key={msg.id || `stream-${i}`} className="flex gap-2 sm:gap-3 items-start">
                    {renderMessageIcon(msg)}
                    {msg.messageType === "deliverable" ? (
                      renderDeliverableInline(msg)
                    ) : (
                      <div className="flex-1 min-w-0 pt-0.5 overflow-hidden break-words">
                        {renderMessageContent(msg)}
                      </div>
                    )}
                  </div>
                ))}

                {isStreaming && (
                  <div className="flex gap-3 items-start">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: agentColor + "20" }}
                    >
                      <Loader2 size={14} className="animate-spin" style={{ color: agentColor }} />
                    </div>
                    <div className="text-sm text-muted-foreground pt-0.5">
                      Working<span className="animate-pulse">...</span>
                    </div>
                  </div>
                )}

                {chatStreaming && chatStreamTokens && (
                  <div className="flex gap-2 sm:gap-3 items-start">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: agentColor + "20" }}
                    >
                      <RefreshCw size={14} className="animate-spin" style={{ color: agentColor }} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground max-h-[200px] overflow-y-auto">
                        {chatStreamTokens}
                        <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
                      </pre>
                    </div>
                  </div>
                )}

                {chatStreaming && !chatStreamTokens && (
                  <div className="flex gap-3 items-start">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: agentColor + "20" }}
                    >
                      <RefreshCw size={14} className="animate-spin" style={{ color: agentColor }} />
                    </div>
                    <div className="text-sm text-muted-foreground pt-0.5">
                      Refining output with your feedback<span className="animate-pulse">...</span>
                    </div>
                  </div>
                )}

                {!isStreaming && !chatStreaming && isAwaitingConfirmation && (
                  <div className="max-w-lg mx-auto pt-4">
                    <Card className="p-5 border-l-4 border-l-amber-500">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle size={18} className="text-amber-500" />
                        <h3 className="font-semibold text-sm">Confirm Positions Before Proceeding</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Review the two sides identified by the Topic Clarifier. Edit if needed, then confirm to proceed to the Strongman arguments.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Side A (Pro)</label>
                          <Textarea
                            value={confirmSideA}
                            onChange={(e) => setConfirmSideA(e.target.value)}
                            className="resize-none min-h-[36px] text-sm"
                            rows={1}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Side B (Con)</label>
                          <Textarea
                            value={confirmSideB}
                            onChange={(e) => setConfirmSideB(e.target.value)}
                            className="resize-none min-h-[36px] text-sm"
                            rows={1}
                          />
                        </div>
                        <Button
                          onClick={() => confirmPositionsMutation.mutate({ sideA: confirmSideA, sideB: confirmSideB })}
                          disabled={confirmPositionsMutation.isPending || !confirmSideA.trim() || !confirmSideB.trim()}
                          size="sm"
                          className="w-full"
                        >
                          {confirmPositionsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Check size={14} /> Confirm Positions</>
                          )}
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}

                {!isStreaming && !chatStreaming && canApprove && (
                  <div className="flex justify-center pt-2">
                    <Button onClick={() => approveStepMutation.mutate()} disabled={approveStepMutation.isPending} size="sm">
                      {approveStepMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Check size={14} /> Approve & Continue</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!hasHistory && (step.status === "completed" || step.status === "approved") && deliverables.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <CheckCircle size={48} className="text-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Step Complete</h2>
                <p className="text-sm">This step finished but no deliverables were recorded.</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border p-3 sm:p-4">
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
              <Textarea
                ref={textareaRef}
                className="flex-1 resize-none min-h-[40px] max-h-[120px]"
                placeholder={
                  isStreaming
                    ? "Agent is running..."
                    : chatStreaming
                    ? "Refining output..."
                    : step.status === "not_started"
                    ? "Run the agent first, then ask follow-up questions here"
                    : `Ask for changes or refinements...`
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isStreaming || chatStreaming || step.status === "not_started"}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!chatInput.trim() || chatStreaming || isStreaming || step.status === "not_started"}
              >
                {chatStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </Button>
            </div>
          </div>
        </div>

        {showPanel && (
          <div className="w-[320px] border-l border-border bg-muted/30 overflow-y-auto shrink-0 hidden sm:block">
            <div className="p-4">
              <h3 className="font-semibold text-sm mb-3">Deliverables</h3>
              {deliverables.length === 0 ? (
                <p className="text-xs text-muted-foreground">No deliverables yet</p>
              ) : (
                <div className="space-y-2">
                  {deliverables.map((d) => (
                    <Card key={d.id} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={14} className="text-primary" />
                        <span className="text-xs font-semibold flex-1 truncate">{d.title}</span>
                        {d.locked && <Lock size={10} className="text-muted-foreground" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-[10px]">v{d.version}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(d.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {isApproved && (
                        <div className="mt-2">
                          <div className="bg-muted rounded p-2 text-xs font-mono overflow-auto max-h-[200px]">
                            <pre className="whitespace-pre-wrap break-words">
                              {typeof d.contentJson === "string"
                                ? d.contentJson
                                : JSON.stringify(d.contentJson, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {agentInfo && (
                <div className="mt-6">
                  <h3 className="font-semibold text-sm mb-2">Agent Info</h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2 font-medium">{agentInfo.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Role:</span>
                      <span className="ml-2" style={{ color: agentColor }}>{agentInfo.role}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Model:</span>
                      <span className="ml-2 font-medium">{agentInfo.configModel || agentInfo.model}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description:</span>
                      <p className="mt-1 text-muted-foreground">{agentInfo.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {previewData && (
        <DeliverablePreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          agentKey={previewData.agentKey}
          content={previewData.content}
          title={previewData.title}
        />
      )}
    </div>
  );
}
