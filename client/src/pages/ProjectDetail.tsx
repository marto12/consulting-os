import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  GitBranch,
  FlaskConical,
  BarChart3,
  FileText,
  Presentation,
  Terminal,
  Check,
  PlayCircle,
  CheckCircle,
  RefreshCw,
  Target,
  Database,
  FunctionSquare,
  List,
  Network,
} from "lucide-react";
import IssuesGraph from "../components/IssuesGraph";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  created: "New",
  issues_draft: "Issues Draft",
  issues_approved: "Issues Approved",
  hypotheses_draft: "Hypotheses Draft",
  hypotheses_approved: "Hypotheses Approved",
  execution_done: "Execution Done",
  execution_approved: "Execution Approved",
  summary_draft: "Summary Draft",
  summary_approved: "Summary Approved",
  presentation_draft: "Presentation Draft",
  complete: "Complete",
};

const WORKFLOW_STEPS = [
  { key: "issues", label: "Issues Tree", stages: ["issues_draft", "issues_approved"] },
  { key: "hypotheses", label: "Hypotheses", stages: ["hypotheses_draft", "hypotheses_approved"] },
  { key: "execution", label: "Execution", stages: ["execution_done", "execution_approved"] },
  { key: "summary", label: "Summary", stages: ["summary_draft", "summary_approved"] },
  { key: "presentation", label: "Presentation", stages: ["presentation_draft", "complete"] },
];

const TABS = ["overview", "issues", "hypotheses", "runs", "summary", "presentation", "logs"] as const;
type TabKey = (typeof TABS)[number];

const TAB_CONFIG: Record<TabKey, { label: string; icon: React.ReactNode }> = {
  overview: { label: "Overview", icon: <Layers size={16} /> },
  issues: { label: "Issues", icon: <GitBranch size={16} /> },
  hypotheses: { label: "Hypotheses", icon: <FlaskConical size={16} /> },
  runs: { label: "Runs", icon: <BarChart3 size={16} /> },
  summary: { label: "Summary", icon: <FileText size={16} /> },
  presentation: { label: "Slides", icon: <Presentation size={16} /> },
  logs: { label: "Logs", icon: <Terminal size={16} /> },
};

function getStepStatus(
  step: (typeof WORKFLOW_STEPS)[number],
  currentStage: string
): "pending" | "active" | "complete" {
  const stageOrder = [
    "created", "issues_draft", "issues_approved", "hypotheses_draft",
    "hypotheses_approved", "execution_done", "execution_approved",
    "summary_draft", "summary_approved", "presentation_draft", "complete",
  ];
  const currentIdx = stageOrder.indexOf(currentStage);
  const stepStartIdx = stageOrder.indexOf(step.stages[0]);
  const stepEndIdx = stageOrder.indexOf(step.stages[step.stages.length - 1]);

  if (currentIdx > stepEndIdx) return "complete";
  if (currentIdx >= stepStartIdx && currentIdx <= stepEndIdx) return "active";
  return "pending";
}

function canRunNext(stage: string): boolean {
  return ["created", "issues_approved", "hypotheses_approved", "execution_approved", "summary_approved"].includes(stage);
}

function canApprove(stage: string): boolean {
  return ["issues_draft", "hypotheses_draft", "execution_done", "summary_draft", "presentation_draft"].includes(stage);
}

const STAGE_TO_TAB: Record<string, TabKey> = {
  issues_draft: "issues",
  issues_approved: "issues",
  hypotheses_draft: "hypotheses",
  hypotheses_approved: "hypotheses",
  execution_done: "runs",
  execution_approved: "runs",
  summary_draft: "summary",
  summary_approved: "summary",
  presentation_draft: "presentation",
  complete: "overview",
};

const STAGE_AGENT_INFO: Record<string, { agent: string; description: string }> = {
  created: { agent: "Issues Tree Agent", description: "Decomposing objective into MECE issues tree..." },
  issues_approved: { agent: "Hypothesis Agent", description: "Generating hypotheses and analysis plans..." },
  hypotheses_approved: { agent: "Execution Agent", description: "Running scenario analysis with calculator tool..." },
  execution_approved: { agent: "Summary Agent", description: "Writing executive summary from results..." },
  summary_approved: { agent: "Presentation Agent", description: "Generating 16:9 presentation slides..." },
};

function useAnimatedDots() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return dots;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false);
  const [runElapsed, setRunElapsed] = useState(0);

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ["/api/projects", id],
    refetchInterval: 3000,
  });

  const { data: artifacts } = useQuery<any>({
    queryKey: ["/api/projects", id, "artifacts"],
    refetchInterval: 5000,
  });

  const { data: logs } = useQuery<any[]>({
    queryKey: ["/api/projects", id, "logs"],
    refetchInterval: 5000,
  });

  const redoMutation = useMutation({
    mutationFn: async (step: string) => {
      const res = await apiRequest("POST", `/api/projects/${id}/redo`, { step });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "artifacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "logs"] });
    },
    onError: (err: Error) => {
      window.alert(err.message);
    },
  });

  const handleRedo = (step: string, label: string) => {
    const msg = `This will reset the workflow back before "${label}" and re-run the analysis. Any later results will need to be regenerated. Continue?`;
    if (window.confirm(msg)) {
      redoMutation.mutate(step);
    }
  };

  const runNextMutation = useMutation({
    mutationFn: async () => {
      setRunElapsed(0);
      const res = await apiRequest("POST", `/api/projects/${id}/run-next`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setRunElapsed(0);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "artifacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "logs"] });
      const newStage = data?.stage;
      if (newStage && STAGE_TO_TAB[newStage]) {
        setActiveTab(STAGE_TO_TAB[newStage]);
      }
    },
    onError: (err: Error) => {
      setRunElapsed(0);
      window.alert(err.message);
    },
  });

  useEffect(() => {
    if (!runNextMutation.isPending) return;
    const interval = setInterval(() => {
      setRunElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [runNextMutation.isPending]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${id}/approve`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "artifacts"] });
      const newStage = data?.stage;
      if (newStage === "complete") {
        setActiveTab("overview");
      }
    },
    onError: (err: Error) => {
      window.alert(err.message);
    },
  });

  useEffect(() => {
    if (project && !hasAutoNavigated) {
      const tab = STAGE_TO_TAB[project.stage];
      if (tab) {
        setActiveTab(tab);
      }
      setHasAutoNavigated(true);
    }
  }, [project, hasAutoNavigated]);

  if (projectLoading || !project) {
    return (
      <div data-testid="project-detail">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const stage = project.stage;
  const showRunNext = canRunNext(stage);
  const showApprove = canApprove(stage);
  const isComplete = stage === "complete";

  return (
    <div data-testid="project-detail">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} data-testid="back-button">
          <ChevronLeft size={24} />
        </Button>
        <div className="text-lg font-semibold flex-1">{project.name}</div>
        <div className="flex-shrink-0" />
      </div>

      <div className="border-b border-border mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors text-muted-foreground hover:text-foreground",
                activeTab === tab && "text-foreground border-b-2 border-primary"
              )}
              onClick={() => setActiveTab(tab)}
              data-testid={`tab-${tab}`}
            >
              {TAB_CONFIG[tab].icon}
              {TAB_CONFIG[tab].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            stage={stage}
            onRedo={handleRedo}
            redoPending={redoMutation.isPending}
          />
        )}
        {activeTab === "issues" && (
          <IssuesTab
            issues={artifacts?.issueNodes || []}
            showApprove={showApprove && stage === "issues_draft"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "hypotheses" && (
          <HypothesesTab
            hypotheses={artifacts?.hypotheses || []}
            plans={artifacts?.analysisPlan || []}
            showApprove={showApprove && stage === "hypotheses_draft"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "runs" && (
          <RunsTab
            runs={artifacts?.modelRuns || []}
            showApprove={showApprove && stage === "execution_done"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "summary" && (
          <SummaryTab
            narratives={artifacts?.narratives || []}
            showApprove={showApprove && stage === "summary_draft"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "presentation" && (
          <PresentationTab
            slides={artifacts?.slides || []}
            showApprove={showApprove && stage === "presentation_draft"}
            onApprove={() => approveMutation.mutate()}
            approvePending={approveMutation.isPending}
          />
        )}
        {activeTab === "logs" && <LogsTab logs={logs || []} />}
      </div>

      {runNextMutation.isPending && (
        <RunningStatusBar stage={stage} elapsed={runElapsed} />
      )}

      {!runNextMutation.isPending && showRunNext && !isComplete && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 flex justify-center" data-testid="action-bar">
          <Button
            size="lg"
            onClick={() => runNextMutation.mutate()}
            disabled={runNextMutation.isPending}
            data-testid="run-next-btn"
          >
            <PlayCircle size={20} />
            Run Next Agent
          </Button>
        </div>
      )}

      {isComplete && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 flex items-center justify-center gap-3" data-testid="complete-bar">
          <CheckCircle size={24} className="text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-500">Workflow Complete</span>
        </div>
      )}
    </div>
  );
}

function RunningStatusBar({ stage, elapsed }: { stage: string; elapsed: number }) {
  const dots = useAnimatedDots();
  const info = STAGE_AGENT_INFO[stage];
  const agentName = info?.agent || "Agent";
  const description = info?.description || "Processing...";

  const phases = [
    { threshold: 0, label: "Initializing" },
    { threshold: 3, label: description.replace("...", "") },
    { threshold: 15, label: "Analyzing with AI" },
    { threshold: 30, label: "Reviewing quality" },
    { threshold: 50, label: "Finalizing output" },
  ];

  let currentPhase = phases[0].label;
  for (const p of phases) {
    if (elapsed >= p.threshold) currentPhase = p.label;
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
    : `${seconds}s`;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50" data-testid="running-bar">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold flex-1">{agentName}</span>
          <span className="text-xs text-muted-foreground font-mono">{timeStr}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 ml-8">{currentPhase}{dots}</div>
      </div>
    </div>
  );
}

function OverviewTab({
  project,
  stage,
  onRedo,
  redoPending,
}: {
  project: any;
  stage: string;
  onRedo: (step: string, label: string) => void;
  redoPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Objective</div>
        <div className="text-sm text-foreground leading-relaxed">{project.objective}</div>
      </Card>
      <Card className="p-5">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Constraints</div>
        <div className="text-sm text-foreground leading-relaxed">{project.constraints}</div>
      </Card>
      <Card className="p-5">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Workflow Progress</div>
        {WORKFLOW_STEPS.map((step, i) => {
          const status = getStepStatus(step, stage);
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                    status === "complete" && "bg-emerald-500 text-white",
                    status === "active" && "bg-blue-500 text-white ring-4 ring-blue-500/20",
                    status === "pending" && "bg-muted text-muted-foreground"
                  )}
                >
                  {status === "complete" ? (
                    <Check size={14} color="#fff" />
                  ) : status === "active" ? (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className={cn("w-0.5 flex-1 mx-auto", status === "complete" ? "bg-emerald-500" : "bg-border")} />
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className={cn("text-sm font-medium", status === "pending" && "text-muted-foreground")}>
                      {step.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {status === "complete"
                        ? "Done"
                        : status === "active"
                        ? STAGE_LABELS[stage] || stage
                        : "Pending"}
                    </div>
                  </div>
                  {(status === "complete" || status === "active") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRedo(step.key, step.label)}
                      disabled={redoPending}
                      data-testid={`redo-${step.key}`}
                    >
                      {redoPending ? (
                        <div className="spinner spinner-sm" />
                      ) : (
                        <>
                          <RefreshCw size={13} />
                          Redo
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
      <Card className="p-5">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Details</div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-sm text-muted-foreground">Created</span>
          <span className="text-sm font-medium">
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-sm text-muted-foreground">Updated</span>
          <span className="text-sm font-medium">
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-sm text-muted-foreground">Current Stage</span>
          <span className="text-sm font-medium text-primary">
            {STAGE_LABELS[stage] || stage}
          </span>
        </div>
      </Card>
    </div>
  );
}

interface ApproveProps {
  showApprove: boolean;
  onApprove: () => void;
  approvePending: boolean;
}

function InlineApproveButton({ showApprove, onApprove, approvePending }: ApproveProps) {
  if (!showApprove) return null;
  return (
    <Button
      className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
      size="lg"
      onClick={onApprove}
      disabled={approvePending}
      data-testid="inline-approve-btn"
    >
      {approvePending ? (
        <div className="spinner spinner-sm spinner-white" />
      ) : (
        <>
          <CheckCircle size={20} />
          Approve & Continue
        </>
      )}
    </Button>
  );
}

function IssuesTab({ issues, showApprove, onApprove, approvePending }: { issues: any[] } & ApproveProps) {
  const [viewMode, setViewMode] = useState<"graph" | "list">("list");

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <GitBranch size={40} />
        <div className="text-base font-semibold">No issues yet</div>
        <div className="text-sm">
          Run the Issues Tree agent to generate the issues breakdown
        </div>
      </div>
    );
  }

  const latestVersion = Math.max(...issues.map((n: any) => n.version));
  const latestIssues = issues.filter((n: any) => n.version === latestVersion);
  const roots = latestIssues.filter((n: any) => !n.parentId);

  function getDescendants(parentId: number): any[] {
    return latestIssues.filter((n: any) => n.parentId === parentId);
  }

  function renderIssueNode(node: any, depth: number): React.ReactNode {
    const nodeChildren = getDescendants(node.id);
    const priorityVariant =
      node.priority === "high"
        ? "destructive"
        : node.priority === "medium"
        ? "warning"
        : "secondary";

    return (
      <div key={node.id} className={depth > 0 ? "ml-4" : ""}>
        {depth > 0 && <div className="w-px h-3 bg-border ml-4" />}
        <div className="flex items-start gap-2 py-1">
          <div
            className={cn(
              "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
              node.priority === "high" && "bg-destructive",
              node.priority === "medium" && "bg-amber-500",
              node.priority !== "high" && node.priority !== "medium" && "bg-muted-foreground"
            )}
          />
          <span className={cn("text-sm flex-1", depth === 0 ? "font-semibold" : "text-foreground")}>
            {node.text}
          </span>
          <Badge variant={priorityVariant as any} className="text-[10px] flex-shrink-0">
            {node.priority}
          </Badge>
        </div>
        {nodeChildren.length > 0 && (
          <div className="ml-2">
            {nodeChildren.map((child: any) => renderIssueNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Badge variant="secondary">Version {latestVersion}</Badge>
        </div>
        <div className="flex border border-border rounded-md overflow-hidden">
          <button
            className={cn(
              "p-2 transition-colors",
              viewMode === "graph" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setViewMode("graph")}
            data-testid="toggle-graph"
          >
            <Network size={16} />
          </button>
          <button
            className={cn(
              "p-2 transition-colors",
              viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setViewMode("list")}
            data-testid="toggle-list"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {viewMode === "graph" ? (
        <IssuesGraph issues={latestIssues.map((n: any) => ({ id: n.id, parentId: n.parentId, text: n.text, priority: n.priority }))} />
      ) : (
        roots.map((root: any) => (
          <Card key={root.id} className="p-4">
            {renderIssueNode(root, 0)}
          </Card>
        ))
      )}
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </div>
  );
}

function HypothesesTab({
  hypotheses,
  plans,
  showApprove,
  onApprove,
  approvePending,
}: {
  hypotheses: any[];
  plans: any[];
} & ApproveProps) {
  if (hypotheses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <FlaskConical size={40} />
        <div className="text-base font-semibold">No hypotheses yet</div>
        <div className="text-sm">
          Run the Hypothesis agent after approving the issues tree
        </div>
      </div>
    );
  }

  const latestVersion = Math.max(...hypotheses.map((h: any) => h.version));
  const latest = hypotheses.filter((h: any) => h.version === latestVersion);

  return (
    <div className="space-y-4">
      <div>
        <Badge variant="secondary">Version {latestVersion}</Badge>
      </div>
      {latest.map((hyp: any, i: number) => {
        const plan = plans.find((p: any) => p.hypothesisId === hyp.id);
        return (
          <Card key={hyp.id} className="p-5">
            <div className="text-xs font-bold text-primary mb-1">H{i + 1}</div>
            <div className="text-sm font-semibold">{hyp.statement}</div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Target size={12} />
                <span>{hyp.metric}</span>
              </div>
              <div className="flex items-center gap-1">
                <Database size={12} />
                <span>{hyp.dataSource}</span>
              </div>
            </div>
            {plan && (
              <div className="bg-muted rounded-lg p-4 mt-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Analysis Plan</div>
                <div className="text-sm">Method: {plan.method}</div>
                <div className="text-sm">Dataset: {plan.requiredDataset}</div>
                {plan.parametersJson && (
                  <pre className="text-xs font-mono mt-2 text-muted-foreground">
                    {JSON.stringify(plan.parametersJson, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </Card>
        );
      })}
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </div>
  );
}

function RunsTab({ runs, showApprove, onApprove, approvePending }: { runs: any[] } & ApproveProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <BarChart3 size={40} />
        <div className="text-base font-semibold">No model runs yet</div>
        <div className="text-sm">
          Run the Execution agent after approving hypotheses
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run: any) => {
        const summary = (run.outputsJson as any)?.summary;
        return (
          <Card key={run.id} className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <FunctionSquare size={18} className="text-primary" />
              <span className="text-sm font-semibold flex-1">{run.toolName}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground">Pessimistic NPV</div>
                  <div className="text-sm font-semibold mt-1 text-destructive">
                    ${summary.pessimisticNPV?.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground">Baseline NPV</div>
                  <div className="text-sm font-semibold mt-1 text-primary">
                    ${summary.baselineNPV?.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground">Optimistic NPV</div>
                  <div className="text-sm font-semibold mt-1 text-emerald-500">
                    ${summary.optimisticNPV?.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground">Expected Value</div>
                  <div className="text-sm font-bold mt-1">
                    ${summary.expectedValue?.toLocaleString()}
                  </div>
                </Card>
              </div>
            )}
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Inputs</div>
              <pre className="text-xs font-mono text-muted-foreground bg-muted rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(run.inputsJson, null, 2)}
              </pre>
            </div>
          </Card>
        );
      })}
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  function renderInline(line: string, key: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*)|(__(.+?)__)/g;
    let lastIndex = 0;
    let match;
    let partIdx = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`${key}-t${partIdx++}`} className="text-sm leading-relaxed">
            {line.slice(lastIndex, match.index)}
          </span>
        );
      }
      parts.push(
        <strong key={`${key}-b${partIdx++}`} className="font-semibold">
          {match[2] || match[4]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(
        <span key={`${key}-t${partIdx++}`} className="text-sm leading-relaxed">
          {line.slice(lastIndex)}
        </span>
      );
    }
    if (parts.length === 0) {
      return <span key={key} className="text-sm leading-relaxed">{line}</span>;
    }
    return <span key={key}>{parts}</span>;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      elements.push(<div key={`sp-${i}`} className="h-3" />);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(<div key={`h3-${i}`} className="text-base font-semibold mt-2 mb-1">{trimmed.slice(4)}</div>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<div key={`h2-${i}`} className="text-lg font-semibold mt-3 mb-2">{trimmed.slice(3)}</div>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<div key={`h1-${i}`} className="text-xl font-bold mt-4 mb-2">{trimmed.slice(2)}</div>);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={`li-${i}`} className="flex gap-2 items-start py-0.5">
          <span className="text-muted-foreground">{"\u2022"}</span>
          <div className="flex-1">{renderInline(trimmed.slice(2), `li-${i}`)}</div>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={`ol-${i}`} className="flex gap-2 items-start py-0.5">
            <span className="text-muted-foreground text-sm font-medium">{numMatch[1]}.</span>
            <div className="flex-1">{renderInline(numMatch[2], `ol-${i}`)}</div>
          </div>
        );
      }
    } else if (trimmed === "---" || trimmed === "***") {
      elements.push(<div key={`hr-${i}`} className="border-t border-border my-4" />);
    } else {
      elements.push(<div key={`p-${i}`}>{renderInline(trimmed, `p-${i}`)}</div>);
    }
  }

  return <div>{elements}</div>;
}

function SummaryTab({ narratives, showApprove, onApprove, approvePending }: { narratives: any[] } & ApproveProps) {
  if (narratives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <FileText size={40} />
        <div className="text-base font-semibold">No summary yet</div>
        <div className="text-sm">
          Run the Summary agent after approving execution results
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {narratives.map((narr: any) => (
        <Card key={narr.id} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary">Version {narr.version}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(narr.createdAt).toLocaleString()}
            </span>
          </div>
          <MarkdownText text={narr.summaryText} />
        </Card>
      ))}
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </div>
  );
}

function PresentationTab({ slides, showApprove, onApprove, approvePending }: { slides: any[] } & ApproveProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Presentation size={40} />
        <div className="text-base font-semibold">No presentation yet</div>
        <div className="text-sm">
          Run the Presentation agent to generate a slide deck
        </div>
      </div>
    );
  }

  const latestVersion = Math.max(...slides.map((s: any) => s.version));
  const latestSlides = slides
    .filter((s: any) => s.version === latestVersion)
    .sort((a: any, b: any) => a.slideIndex - b.slideIndex);

  const slide = latestSlides[currentSlide];
  if (!slide) return null;

  const body = typeof slide.bodyJson === "string" ? JSON.parse(slide.bodyJson) : slide.bodyJson;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4 mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
          data-testid="slide-prev"
        >
          <ChevronLeft size={20} />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          {currentSlide + 1} / {latestSlides.length}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentSlide(Math.min(latestSlides.length - 1, currentSlide + 1))}
          disabled={currentSlide === latestSlides.length - 1}
          data-testid="slide-next"
        >
          <ChevronRight size={20} />
        </Button>
      </div>

      <div>
        <div className="aspect-video bg-white rounded-xl border border-border shadow-sm p-8 flex items-center justify-center">
          {slide.layout === "title_slide" && (
            <div className="text-center">
              <div className="w-16 h-1 bg-primary mx-auto mb-6 rounded-full" />
              <div className="text-2xl font-bold text-slate-900">{slide.title}</div>
              {slide.subtitle && <div className="text-base text-slate-500 mt-3">{slide.subtitle}</div>}
            </div>
          )}

          {slide.layout === "section_header" && (
            <div className="text-center">
              <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full" />
              <div className="text-xl font-bold text-slate-900">{slide.title}</div>
              {slide.subtitle && <div className="text-sm text-slate-500 mt-2">{slide.subtitle}</div>}
            </div>
          )}

          {slide.layout === "title_body" && (
            <div className="w-full">
              <div className="text-lg font-bold text-slate-900 mb-3">{slide.title}</div>
              {slide.subtitle && <div className="text-sm text-slate-500 mb-4">{slide.subtitle}</div>}
              {body?.bullets && (
                <div className="space-y-2">
                  {body.bullets.map((b: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {slide.layout === "two_column" && (
            <div className="w-full">
              <div className="text-lg font-bold text-slate-900 mb-4">{slide.title}</div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-semibold text-slate-700 mb-2">{body?.leftTitle || "Left"}</div>
                  {(body?.leftBullets || []).map((b: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{b}</span>
                    </div>
                  ))}
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <div className="text-sm font-semibold text-slate-700 mb-2">{body?.rightTitle || "Right"}</div>
                  {(body?.rightBullets || []).map((b: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {slide.layout === "metrics" && (
            <div className="w-full">
              <div className="text-lg font-bold text-slate-900 mb-4">{slide.title}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(body?.metrics || []).map((m: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-xl font-bold text-slate-900">{m.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{m.label}</div>
                    {m.change && (
                      <div
                        className={cn(
                          "text-xs font-semibold mt-1",
                          m.change.startsWith("+") ? "text-emerald-600" : m.change.startsWith("-") ? "text-red-600" : "text-blue-600"
                        )}
                      >
                        {m.change}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {slide.notesText && (
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Speaker Notes</div>
          <div className="text-sm text-foreground leading-relaxed">{slide.notesText}</div>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto mt-4">
        {latestSlides.map((s: any, i: number) => (
          <button
            key={s.id}
            onClick={() => setCurrentSlide(i)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap",
              i === currentSlide
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            )}
            data-testid={`slide-thumb-${i}`}
          >
            <span>{s.title}</span>
          </button>
        ))}
      </div>
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </div>
  );
}

function LogsTab({ logs }: { logs: any[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Terminal size={40} />
        <div className="text-base font-semibold">No logs yet</div>
        <div className="text-sm">
          Agent run logs will appear here
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log: any) => {
        const badgeVariant =
          log.status === "success"
            ? "success"
            : log.status === "failed"
            ? "destructive"
            : "warning";

        return (
          <Card key={log.id} className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={badgeVariant as any}>
                {log.status}
              </Badge>
              <span className="text-sm font-medium">{STAGE_LABELS[log.stage] || log.stage}</span>
              <span className="text-xs text-muted-foreground ml-auto">{log.modelUsed}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {new Date(log.createdAt).toLocaleString()}
            </div>
            {log.errorText && (
              <div className="text-sm text-destructive mt-2 bg-destructive/10 rounded-md p-2">{log.errorText}</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
