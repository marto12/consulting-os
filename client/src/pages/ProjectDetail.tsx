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
import "./ProjectDetail.css";

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
      <div className="project-detail" data-testid="project-detail">
        <div className="loading">
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
    <div className="project-detail" data-testid="project-detail">
      <div className="pd-top-bar">
        <button className="pd-back-button" onClick={() => navigate("/projects")} data-testid="back-button">
          <ChevronLeft size={24} />
        </button>
        <div className="pd-top-bar-title">{project.name}</div>
        <div className="pd-top-bar-spacer" />
      </div>

      <div className="pd-tab-bar">
        <div className="pd-tab-scroll">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`pd-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
              data-testid={`tab-${tab}`}
            >
              {TAB_CONFIG[tab].icon}
              {TAB_CONFIG[tab].label}
            </button>
          ))}
        </div>
      </div>

      <div className="pd-scroll-content">
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
        <div className="pd-action-bar" data-testid="action-bar">
          <button
            className="pd-action-button run"
            onClick={() => runNextMutation.mutate()}
            disabled={runNextMutation.isPending}
            data-testid="run-next-btn"
          >
            <PlayCircle size={20} />
            Run Next Agent
          </button>
        </div>
      )}

      {isComplete && (
        <div className="pd-action-bar complete-bar" data-testid="complete-bar">
          <CheckCircle size={24} color="var(--color-success)" />
          <span className="pd-complete-text">Workflow Complete</span>
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
    <div className="pd-running-bar" data-testid="running-bar">
      <div className="pd-running-bar-content">
        <div className="pd-running-bar-top">
          <div className="pd-running-spinner" />
          <span className="pd-running-bar-agent">{agentName}</span>
          <span className="pd-running-bar-time">{timeStr}</span>
        </div>
        <div className="pd-running-bar-status">{currentPhase}{dots}</div>
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
    <div className="pd-tab-content">
      <div className="pd-section">
        <div className="pd-section-title">Objective</div>
        <div className="pd-section-body">{project.objective}</div>
      </div>
      <div className="pd-section">
        <div className="pd-section-title">Constraints</div>
        <div className="pd-section-body">{project.constraints}</div>
      </div>
      <div className="pd-section">
        <div className="pd-section-title">Workflow Progress</div>
        {WORKFLOW_STEPS.map((step, i) => {
          const status = getStepStatus(step, stage);
          return (
            <div key={step.key} className="pd-workflow-step">
              <div className="pd-step-indicator">
                <div className={`pd-step-circle ${status}`}>
                  {status === "complete" ? (
                    <Check size={14} color="#fff" />
                  ) : status === "active" ? (
                    <div className="pd-step-dot-inner" />
                  ) : (
                    <span className="pd-step-number">{i + 1}</span>
                  )}
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className={`pd-step-line${status === "complete" ? " complete" : ""}`} />
                )}
              </div>
              <div className="pd-step-info">
                <div className="pd-step-info-row">
                  <div style={{ flex: 1 }}>
                    <div className={`pd-step-label ${status}`}>{step.label}</div>
                    <div className="pd-step-status">
                      {status === "complete"
                        ? "Done"
                        : status === "active"
                        ? STAGE_LABELS[stage] || stage
                        : "Pending"}
                    </div>
                  </div>
                  {(status === "complete" || status === "active") && (
                    <button
                      className="pd-redo-button"
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
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="pd-section">
        <div className="pd-section-title">Details</div>
        <div className="pd-detail-row">
          <span className="pd-detail-label">Created</span>
          <span className="pd-detail-value">
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="pd-detail-row">
          <span className="pd-detail-label">Updated</span>
          <span className="pd-detail-value">
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>
        <div className="pd-detail-row">
          <span className="pd-detail-label">Current Stage</span>
          <span className="pd-detail-value" style={{ color: "var(--color-accent)" }}>
            {STAGE_LABELS[stage] || stage}
          </span>
        </div>
      </div>
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
    <button
      className="pd-inline-approve-btn"
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
    </button>
  );
}

function IssuesTab({ issues, showApprove, onApprove, approvePending }: { issues: any[] } & ApproveProps) {
  const [viewMode, setViewMode] = useState<"graph" | "list">("list");

  if (issues.length === 0) {
    return (
      <div className="pd-empty-tab">
        <GitBranch size={40} />
        <div className="pd-empty-tab-title">No issues yet</div>
        <div className="pd-empty-tab-text">
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
    const priorityColor =
      node.priority === "high"
        ? "var(--color-error)"
        : node.priority === "medium"
        ? "var(--color-warning)"
        : "var(--color-text-muted)";

    const priorityBg =
      node.priority === "high"
        ? "var(--color-error-bg)"
        : node.priority === "medium"
        ? "var(--color-warning-bg)"
        : "var(--color-bg)";

    return (
      <div key={node.id} className={depth > 0 ? "pd-issue-child" : ""}>
        {depth > 0 && <div className="pd-issue-child-line" />}
        <div className={depth === 0 ? "pd-issue-root-header" : "pd-issue-child-content"}>
          <div className="pd-priority-dot" style={{ background: priorityColor }} />
          <span className={depth === 0 ? "pd-issue-root-text" : "pd-issue-child-text"}>
            {node.text}
          </span>
          <span className="pd-priority-badge" style={{ background: priorityBg }}>
            <span className="pd-priority-text" style={{ color: priorityColor }}>
              {node.priority}
            </span>
          </span>
        </div>
        {nodeChildren.length > 0 && (
          <div style={{ marginLeft: 8 }}>
            {nodeChildren.map((child: any) => renderIssueNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pd-tab-content">
      <div className="pd-view-toggle-row">
        <div className="pd-version-badge-row">
          <span className="pd-version-badge">Version {latestVersion}</span>
        </div>
        <div className="pd-view-toggle">
          <button
            className={`pd-view-toggle-btn${viewMode === "graph" ? " active" : ""}`}
            onClick={() => setViewMode("graph")}
            data-testid="toggle-graph"
          >
            <Network size={16} />
          </button>
          <button
            className={`pd-view-toggle-btn${viewMode === "list" ? " active" : ""}`}
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
          <div key={root.id} className="pd-issue-root">
            {renderIssueNode(root, 0)}
          </div>
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
      <div className="pd-empty-tab">
        <FlaskConical size={40} />
        <div className="pd-empty-tab-title">No hypotheses yet</div>
        <div className="pd-empty-tab-text">
          Run the Hypothesis agent after approving the issues tree
        </div>
      </div>
    );
  }

  const latestVersion = Math.max(...hypotheses.map((h: any) => h.version));
  const latest = hypotheses.filter((h: any) => h.version === latestVersion);

  return (
    <div className="pd-tab-content">
      <div className="pd-version-badge-row">
        <span className="pd-version-badge">Version {latestVersion}</span>
      </div>
      {latest.map((hyp: any, i: number) => {
        const plan = plans.find((p: any) => p.hypothesisId === hyp.id);
        return (
          <div key={hyp.id} className="pd-hyp-card">
            <div className="pd-hyp-index">H{i + 1}</div>
            <div className="pd-hyp-statement">{hyp.statement}</div>
            <div className="pd-hyp-meta">
              <div className="pd-hyp-meta-item">
                <Target size={12} />
                <span className="pd-hyp-meta-text">{hyp.metric}</span>
              </div>
              <div className="pd-hyp-meta-item">
                <Database size={12} />
                <span className="pd-hyp-meta-text">{hyp.dataSource}</span>
              </div>
            </div>
            {plan && (
              <div className="pd-plan-box">
                <div className="pd-plan-title">Analysis Plan</div>
                <div className="pd-plan-method">Method: {plan.method}</div>
                <div className="pd-plan-dataset">Dataset: {plan.requiredDataset}</div>
                {plan.parametersJson && (
                  <div className="pd-plan-params">
                    {JSON.stringify(plan.parametersJson, null, 2)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </div>
  );
}

function RunsTab({ runs, showApprove, onApprove, approvePending }: { runs: any[] } & ApproveProps) {
  if (runs.length === 0) {
    return (
      <div className="pd-empty-tab">
        <BarChart3 size={40} />
        <div className="pd-empty-tab-title">No model runs yet</div>
        <div className="pd-empty-tab-text">
          Run the Execution agent after approving hypotheses
        </div>
      </div>
    );
  }

  return (
    <div className="pd-tab-content">
      {runs.map((run: any) => {
        const summary = (run.outputsJson as any)?.summary;
        return (
          <div key={run.id} className="pd-run-card">
            <div className="pd-run-header">
              <FunctionSquare size={18} color="var(--color-accent)" />
              <span className="pd-run-tool-name">{run.toolName}</span>
              <span className="pd-run-date">
                {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
            {summary && (
              <div className="pd-scenario-grid">
                <div className="pd-scenario-item">
                  <div className="pd-scenario-label">Pessimistic NPV</div>
                  <div className="pd-scenario-value" style={{ color: "var(--color-error)" }}>
                    ${summary.pessimisticNPV?.toLocaleString()}
                  </div>
                </div>
                <div className="pd-scenario-item">
                  <div className="pd-scenario-label">Baseline NPV</div>
                  <div className="pd-scenario-value" style={{ color: "var(--color-accent)" }}>
                    ${summary.baselineNPV?.toLocaleString()}
                  </div>
                </div>
                <div className="pd-scenario-item">
                  <div className="pd-scenario-label">Optimistic NPV</div>
                  <div className="pd-scenario-value" style={{ color: "var(--color-success)" }}>
                    ${summary.optimisticNPV?.toLocaleString()}
                  </div>
                </div>
                <div className="pd-scenario-item">
                  <div className="pd-scenario-label">Expected Value</div>
                  <div className="pd-scenario-value-bold">
                    ${summary.expectedValue?.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
            <div className="pd-run-details">
              <div className="pd-run-details-label">Inputs</div>
              <div className="pd-run-details-text">
                {JSON.stringify(run.inputsJson, null, 2)}
              </div>
            </div>
          </div>
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
          <span key={`${key}-t${partIdx++}`} className="pd-md-body">
            {line.slice(lastIndex, match.index)}
          </span>
        );
      }
      parts.push(
        <strong key={`${key}-b${partIdx++}`} className="pd-md-bold">
          {match[2] || match[4]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(
        <span key={`${key}-t${partIdx++}`} className="pd-md-body">
          {line.slice(lastIndex)}
        </span>
      );
    }
    if (parts.length === 0) {
      return <span key={key} className="pd-md-body">{line}</span>;
    }
    return <span key={key}>{parts}</span>;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      elements.push(<div key={`sp-${i}`} className="pd-md-spacer" />);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(<div key={`h3-${i}`} className="pd-md-h3">{trimmed.slice(4)}</div>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<div key={`h2-${i}`} className="pd-md-h2">{trimmed.slice(3)}</div>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<div key={`h1-${i}`} className="pd-md-h1">{trimmed.slice(2)}</div>);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={`li-${i}`} className="pd-md-bullet-row">
          <span className="pd-md-bullet-dot">{"\u2022"}</span>
          <div style={{ flex: 1 }}>{renderInline(trimmed.slice(2), `li-${i}`)}</div>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={`ol-${i}`} className="pd-md-bullet-row">
            <span className="pd-md-ordered-num">{numMatch[1]}.</span>
            <div style={{ flex: 1 }}>{renderInline(numMatch[2], `ol-${i}`)}</div>
          </div>
        );
      }
    } else if (trimmed === "---" || trimmed === "***") {
      elements.push(<div key={`hr-${i}`} className="pd-md-hr" />);
    } else {
      elements.push(<div key={`p-${i}`}>{renderInline(trimmed, `p-${i}`)}</div>);
    }
  }

  return <div className="pd-md-container">{elements}</div>;
}

function SummaryTab({ narratives, showApprove, onApprove, approvePending }: { narratives: any[] } & ApproveProps) {
  if (narratives.length === 0) {
    return (
      <div className="pd-empty-tab">
        <FileText size={40} />
        <div className="pd-empty-tab-title">No summary yet</div>
        <div className="pd-empty-tab-text">
          Run the Summary agent after approving execution results
        </div>
      </div>
    );
  }

  return (
    <div className="pd-tab-content">
      {narratives.map((narr: any) => (
        <div key={narr.id} className="pd-narrative-card">
          <div className="pd-narrative-header">
            <span className="pd-version-badge">Version {narr.version}</span>
            <span className="pd-narrative-date">
              {new Date(narr.createdAt).toLocaleString()}
            </span>
          </div>
          <MarkdownText text={narr.summaryText} />
        </div>
      ))}
      <InlineApproveButton showApprove={showApprove} onApprove={onApprove} approvePending={approvePending} />
    </div>
  );
}

function PresentationTab({ slides, showApprove, onApprove, approvePending }: { slides: any[] } & ApproveProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (slides.length === 0) {
    return (
      <div className="pd-empty-tab">
        <Presentation size={40} />
        <div className="pd-empty-tab-title">No presentation yet</div>
        <div className="pd-empty-tab-text">
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
    <div className="pd-tab-content">
      <div className="pd-slide-controls">
        <button
          className="pd-slide-nav-btn"
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
          data-testid="slide-prev"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="pd-slide-counter">
          {currentSlide + 1} / {latestSlides.length}
        </span>
        <button
          className="pd-slide-nav-btn"
          onClick={() => setCurrentSlide(Math.min(latestSlides.length - 1, currentSlide + 1))}
          disabled={currentSlide === latestSlides.length - 1}
          data-testid="slide-next"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="pd-slide-wrapper">
        <div className="pd-slide-frame">
          {slide.layout === "title_slide" && (
            <div className="pd-slide-title-layout">
              <div className="pd-slide-title-accent" />
              <div className="pd-slide-title-main">{slide.title}</div>
              {slide.subtitle && <div className="pd-slide-title-sub">{slide.subtitle}</div>}
            </div>
          )}

          {slide.layout === "section_header" && (
            <div className="pd-slide-section-layout">
              <div className="pd-slide-section-bar" />
              <div className="pd-slide-section-title">{slide.title}</div>
              {slide.subtitle && <div className="pd-slide-section-sub">{slide.subtitle}</div>}
            </div>
          )}

          {slide.layout === "title_body" && (
            <div className="pd-slide-body-layout">
              <div className="pd-slide-body-title">{slide.title}</div>
              {slide.subtitle && <div className="pd-slide-body-subtitle">{slide.subtitle}</div>}
              {body?.bullets && (
                <div className="pd-slide-bullets">
                  {body.bullets.map((b: string, i: number) => (
                    <div key={i} className="pd-slide-bullet-row">
                      <div className="pd-slide-bullet-dot" />
                      <span className="pd-slide-bullet-text">{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {slide.layout === "two_column" && (
            <div className="pd-slide-body-layout">
              <div className="pd-slide-body-title">{slide.title}</div>
              <div className="pd-slide-two-col">
                <div className="pd-slide-col">
                  <div className="pd-slide-col-title">{body?.leftTitle || "Left"}</div>
                  {(body?.leftBullets || []).map((b: string, i: number) => (
                    <div key={i} className="pd-slide-bullet-row">
                      <div className="pd-slide-bullet-dot" />
                      <span className="pd-slide-bullet-text">{b}</span>
                    </div>
                  ))}
                </div>
                <div className="pd-slide-col-divider" />
                <div className="pd-slide-col">
                  <div className="pd-slide-col-title">{body?.rightTitle || "Right"}</div>
                  {(body?.rightBullets || []).map((b: string, i: number) => (
                    <div key={i} className="pd-slide-bullet-row">
                      <div className="pd-slide-bullet-dot" />
                      <span className="pd-slide-bullet-text">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {slide.layout === "metrics" && (
            <div className="pd-slide-body-layout">
              <div className="pd-slide-body-title">{slide.title}</div>
              <div className="pd-slide-metrics-grid">
                {(body?.metrics || []).map((m: any, i: number) => (
                  <div key={i} className="pd-slide-metric-card">
                    <div className="pd-slide-metric-value">{m.value}</div>
                    <div className="pd-slide-metric-label">{m.label}</div>
                    {m.change && (
                      <div
                        className="pd-slide-metric-change"
                        style={{
                          color: m.change.startsWith("+")
                            ? "var(--color-success)"
                            : m.change.startsWith("-")
                            ? "var(--color-error)"
                            : "var(--color-accent)",
                        }}
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
        <div className="pd-slide-notes-box">
          <div className="pd-slide-notes-label">Speaker Notes</div>
          <div className="pd-slide-notes-text">{slide.notesText}</div>
        </div>
      )}

      <div className="pd-slide-thumbnails">
        {latestSlides.map((s: any, i: number) => (
          <button
            key={s.id}
            onClick={() => setCurrentSlide(i)}
            className={`pd-slide-thumbnail${i === currentSlide ? " active" : ""}`}
            data-testid={`slide-thumb-${i}`}
          >
            <span className="pd-slide-thumbnail-text">{s.title}</span>
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
      <div className="pd-empty-tab">
        <Terminal size={40} />
        <div className="pd-empty-tab-title">No logs yet</div>
        <div className="pd-empty-tab-text">
          Agent run logs will appear here
        </div>
      </div>
    );
  }

  return (
    <div className="pd-tab-content">
      {logs.map((log: any) => {
        const statusBg =
          log.status === "success"
            ? "var(--color-success-bg)"
            : log.status === "failed"
            ? "var(--color-error-bg)"
            : "var(--color-warning-bg)";
        const statusColor =
          log.status === "success"
            ? "var(--color-success)"
            : log.status === "failed"
            ? "var(--color-error)"
            : "var(--color-warning)";

        return (
          <div key={log.id} className="pd-log-card">
            <div className="pd-log-header">
              <span className="pd-log-status" style={{ background: statusBg }}>
                <span className="pd-log-status-text" style={{ color: statusColor }}>
                  {log.status}
                </span>
              </span>
              <span className="pd-log-stage">{STAGE_LABELS[log.stage] || log.stage}</span>
              <span className="pd-log-model">{log.modelUsed}</span>
            </div>
            <div className="pd-log-date">
              {new Date(log.createdAt).toLocaleString()}
            </div>
            {log.errorText && (
              <div className="pd-log-error">{log.errorText}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
