import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Link as LinkIcon, Play } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import ChartRenderer from "../components/ChartRenderer";
import { useUserContext } from "../lib/user-context";
import { apiRequest } from "../lib/query-client";
import { parseDeliverableContent } from "../lib/deliverables";
import { formatDeliverableText } from "../lib/deliverable-format";

type ProjectTask = {
  id: number;
  phaseId?: number | null;
  title: string;
  description: string;
  taskType: "human" | "agent" | "client";
  ownerType: string;
  status: string;
  assigneeUserId?: number | null;
  workflowStepId: number | null;
  dependsOn?: number[] | null;
  sortOrder?: number;
};

type WorkflowStep = {
  id: number;
  name: string;
  status?: string;
  workflowName?: string | null;
  agentKey?: string | null;
};

type ManagementData = {
  phases?: Array<{ id: number; title: string; sortOrder: number }>;
  tasks: ProjectTask[];
  workflowSteps: WorkflowStep[];
};

function sortTasksByDependencies<T extends { id: number; sortOrder?: number; dependsOn?: number[] | null }>(tasks: T[]): T[] {
  const taskMap = new Map<number, T>();
  tasks.forEach((task) => taskMap.set(task.id, task));

  const inDegree = new Map<number, number>();
  const dependents = new Map<number, number[]>();
  tasks.forEach((task) => {
    inDegree.set(task.id, 0);
    dependents.set(task.id, []);
  });

  tasks.forEach((task) => {
    (task.dependsOn || []).forEach((depId) => {
      if (!taskMap.has(depId)) return;
      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      dependents.get(depId)?.push(task.id);
    });
  });

  const queue = tasks
    .filter((task) => (inDegree.get(task.id) || 0) === 0)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const result: T[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    result.push(current);
    (dependents.get(current.id) || []).forEach((nextId) => {
      const nextDegree = (inDegree.get(nextId) || 0) - 1;
      inDegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        const nextTask = taskMap.get(nextId);
        if (nextTask) {
          queue.push(nextTask);
          queue.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        }
      }
    });
  }

  if (result.length !== tasks.length) {
    const remaining = tasks
      .filter((task) => !result.find((item) => item.id === task.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    result.push(...remaining);
  }

  return result;
}

type Deliverable = {
  id: number;
  stepId: number;
  title: string;
  version: number;
  createdAt: string;
  contentJson?: any;
};

type Chart = {
  id: number;
  projectId?: number | null;
  name: string;
  description?: string | null;
  chartType: string;
  chartConfig: any;
};

type RunMessage = {
  type: string;
  content: string;
  timestamp: number;
};

type TableData = {
  columns: string[];
  rows: Array<Record<string, any>>;
};

function extractTableData(payload: any): TableData | null {
  if (!payload) return null;

  const normalizeRows = (rows: Array<Record<string, any>>): TableData | null => {
    if (!rows.length) return null;
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    if (!columns.length) return null;
    return { columns, rows };
  };

  const arrayLike = (value: any) => Array.isArray(value) && value.length > 0;

  if (arrayLike(payload) && typeof payload[0] === "object" && payload[0] !== null) {
    return normalizeRows(payload);
  }

  if (payload.data && arrayLike(payload.data) && typeof payload.data[0] === "object") {
    return normalizeRows(payload.data);
  }

  if (payload.output && arrayLike(payload.output) && typeof payload.output[0] === "object") {
    return normalizeRows(payload.output);
  }

  if (payload.rows && payload.columns && Array.isArray(payload.columns)) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (!rows.length) return null;
    if (typeof rows[0] === "object" && rows[0] !== null) {
      return { columns: payload.columns, rows };
    }
  }

  if (payload.timeseries && typeof payload.timeseries === "object") {
    const series = payload.timeseries as Record<string, any[]>;
    const seriesKeys = Object.keys(series).filter((key) => Array.isArray(series[key]) && series[key].length > 0);
    if (seriesKeys.length > 0) {
      const xKeys = ["period", "year", "date", "time"];
      const rowsByKey = new Map<string, Record<string, any>>();
      let xKey = "index";

      const firstSeries = series[seriesKeys[0]];
      const sample = firstSeries?.[0];
      if (sample && typeof sample === "object") {
        xKey = xKeys.find((k) => k in sample) || xKey;
      }

      seriesKeys.forEach((key) => {
        const points = series[key];
        points.forEach((point: any, idx: number) => {
          const label = typeof point === "object" && point !== null
            ? (point[xKey] ?? idx)
            : idx;
          const rowKey = String(label);
          if (!rowsByKey.has(rowKey)) {
            rowsByKey.set(rowKey, { [xKey]: label });
          }
          const row = rowsByKey.get(rowKey) as Record<string, any>;
          row[key] = typeof point === "object" && point !== null ? point.value ?? point[yKeyFromPoint(point)] ?? point : point;
        });
      });

      const rows = Array.from(rowsByKey.values());
      const columns = [xKey, ...seriesKeys];
      return { columns, rows };
    }
  }

  return null;
}

function yKeyFromPoint(point: Record<string, any>): string {
  const candidates = ["value", "amount", "impact"];
  return candidates.find((key) => key in point) || "value";
}

function FormattedText({ text }: { text: string }) {
  return (
    <div className="text-xs leading-relaxed break-words overflow-hidden" style={{ wordBreak: "break-word" }}>
      {text.split("\n").map((line, i) => {
        if (line.match(/^\*\*.*\*\*$/)) {
          return <p key={i} className="font-semibold text-foreground mt-2 mb-1">{line.replace(/\*\*/g, "")}</p>;
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
            return <p key={i} className="mt-1"><span className="font-semibold text-foreground">{parts[1]}</span> {parts[2]}</p>;
          }
        }
        if (line.match(/^\*\*.*\*\*/)) {
          const cleaned = line.replace(/\*\*/g, "");
          return <p key={i} className="font-semibold text-foreground mt-2 mb-1">{cleaned}</p>;
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
          return <p key={i} className="font-semibold text-foreground mt-2 mb-1 text-sm">{cleaned}</p>;
        }
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} className="text-foreground">{line}</p>;
      })}
    </div>
  );
}

const STATUS_OPTIONS: Record<ProjectTask["taskType"], Array<{ value: string; label: string }>> = {
  human: [
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "blocked", label: "Blocked" },
    { value: "under_review", label: "Under review" },
    { value: "rework_required", label: "Rework required" },
    { value: "complete", label: "Complete" },
  ],
  agent: [
    { value: "not_started", label: "Not started" },
    { value: "running", label: "Running" },
    { value: "blocked", label: "Blocked" },
    { value: "under_review", label: "Under review" },
    { value: "rework_required", label: "Rework required" },
    { value: "complete", label: "Complete" },
  ],
  client: [
    { value: "not_started", label: "Not started" },
    { value: "awaiting_client", label: "Awaiting client" },
    { value: "under_review", label: "Under review" },
    { value: "rework_required", label: "Rework required" },
    { value: "complete", label: "Complete" },
  ],
};

export default function TaskDetail() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const projectId = Number(id);
  const taskIdNumber = Number(taskId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { users } = useUserContext();
  const queryClient = useQueryClient();
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [workflowStepDraft, setWorkflowStepDraft] = useState("");
  const [runState, setRunState] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [runMessages, setRunMessages] = useState<RunMessage[]>([]);
  const runStartedRef = useRef(false);
  const runStreamRef = useRef<EventSource | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());

  const { data: managementData } = useQuery<ManagementData>({
    queryKey: ["/api/projects", projectId, "management"],
    enabled: Number.isFinite(projectId),
  });

  const { data: deliverables = [] } = useQuery<Deliverable[]>({
    queryKey: ["/api/projects", projectId, "deliverables"],
    enabled: Number.isFinite(projectId),
  });

  const { data: projectCharts = [] } = useQuery<Chart[]>({
    queryKey: ["/api/projects", projectId, "charts"],
    enabled: Number.isFinite(projectId),
  });

  const [chartRowsById, setChartRowsById] = useState<Record<number, any[]>>({});

  const fetchChartData = useCallback(async (chartId: number) => {
    if (chartRowsById[chartId]) return;
    const res = await fetch(`/api/charts/${chartId}/data`);
    if (!res.ok) return;
    const data = await res.json();
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    setChartRowsById((prev) => ({ ...prev, [chartId]: rows }));
  }, [chartRowsById]);

  const orderedTasks = useMemo(() => {
    const tasks = managementData?.tasks || [];
    if (tasks.length === 0) return [] as ProjectTask[];
    const phases = (managementData?.phases || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const tasksByPhase = new Map<number | null, ProjectTask[]>();
    tasks.forEach((task) => {
      const key = task.phaseId ?? null;
      if (!tasksByPhase.has(key)) tasksByPhase.set(key, []);
      tasksByPhase.get(key)?.push(task);
    });
    tasksByPhase.forEach((group, key) => {
      tasksByPhase.set(key, sortTasksByDependencies(group));
    });

    const ordered: ProjectTask[] = [];
    phases.forEach((phase) => {
      const group = tasksByPhase.get(phase.id) || [];
      ordered.push(...group);
    });
    const unassigned = tasksByPhase.get(null) || [];
    ordered.push(...unassigned);
    return ordered;
  }, [managementData?.phases, managementData?.tasks]);

  const taskIndex = useMemo(() => {
    if (orderedTasks.length === 0) return -1;
    return orderedTasks.findIndex((t) => t.id === taskIdNumber);
  }, [orderedTasks, taskIdNumber]);

  const task = useMemo(() => {
    if (taskIndex === -1) return null;
    return orderedTasks[taskIndex] || null;
  }, [orderedTasks, taskIndex]);

  const previousTask = useMemo(() => {
    if (taskIndex <= 0) return null;
    return orderedTasks[taskIndex - 1] || null;
  }, [orderedTasks, taskIndex]);

  const nextTask = useMemo(() => {
    if (taskIndex === -1 || taskIndex >= orderedTasks.length - 1) return null;
    return orderedTasks[taskIndex + 1] || null;
  }, [orderedTasks, taskIndex]);

  const workflowStep = useMemo(() => {
    if (!task?.workflowStepId) return null;
    return managementData?.workflowSteps.find((step) => step.id === task.workflowStepId) || null;
  }, [managementData?.workflowSteps, task?.workflowStepId]);

  const workflowStepById = useMemo(() => {
    const map = new Map<number, WorkflowStep>();
    managementData?.workflowSteps.forEach((step) => map.set(step.id, step));
    return map;
  }, [managementData?.workflowSteps]);

  const workflowStepLabel = useMemo(() => {
    if (!workflowStep) return "None";
    return workflowStep.workflowName ? `${workflowStep.workflowName} · ${workflowStep.name}` : workflowStep.name;
  }, [workflowStep]);

  const workflowStatusLabel = useMemo(() => {
    if (!workflowStep?.status) return null;
    return workflowStep.status.replace(/_/g, " ");
  }, [workflowStep?.status]);

  const parseRunPayload = useCallback((value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, []);

  const renderRunMessage = useCallback((message: RunMessage) => {
    if (message.type === "complete") {
      const payload = parseRunPayload(message.content);
      if (payload && typeof payload === "object") {
        const deliverableTitle = payload.deliverableTitle || payload.title || "Deliverable ready";
        const projectName = payload.project?.name;
        const projectStage = payload.project?.stage?.replace?.(/_/g, " ");
        const stepName = payload.step?.name;
        const stepStatus = payload.step?.status?.replace?.(/_/g, " ");
        return (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="text-xs font-semibold text-emerald-700">Run complete</div>
            <div className="mt-1 text-xs text-emerald-700">
              Deliverable: <span className="font-semibold text-emerald-900">{deliverableTitle}</span>
            </div>
            {(stepName || stepStatus) && (
              <div className="mt-1 text-[11px] text-emerald-700">
                Step: {stepName || "Workflow step"}{stepStatus ? ` · ${stepStatus}` : ""}
              </div>
            )}
            {(projectName || projectStage) && (
              <div className="mt-1 text-[11px] text-emerald-700">
                Project: {projectName || "Project"}{projectStage ? ` · ${projectStage}` : ""}
              </div>
            )}
          </div>
        );
      }
      return <div className="text-xs text-emerald-700">Run complete.</div>;
    }

    if (message.type === "error") {
      return <div className="text-xs text-rose-600">{message.content}</div>;
    }

    return <div className="text-xs text-muted-foreground">{message.content}</div>;
  }, [parseRunPayload]);

  const assigneeName = useMemo(() => {
    if (!task?.assigneeUserId) return "Unassigned";
    return users.find((u) => u.id === task.assigneeUserId)?.name ?? "Unassigned";
  }, [task?.assigneeUserId, users]);

  useEffect(() => {
    if (!task) return;
    setTitleDraft(task.title || "");
    setDescriptionDraft(task.description || "");
    setStatusDraft(task.status || "not_started");
    setAssigneeDraft(task.assigneeUserId ? String(task.assigneeUserId) : "");
    setWorkflowStepDraft(task.workflowStepId ? String(task.workflowStepId) : "");
  }, [task]);

  const updateTaskMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/tasks/${taskIdNumber}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "management"] });
    },
  });

  const hasChanges = useMemo(() => {
    if (!task) return false;
    const titleChanged = titleDraft !== task.title;
    const descriptionChanged = descriptionDraft !== (task.description || "");
    const statusChanged = statusDraft && statusDraft !== task.status;
    const assigneeChanged =
      (task.assigneeUserId ? String(task.assigneeUserId) : "") !== assigneeDraft;
    const workflowChanged =
      (task.workflowStepId ? String(task.workflowStepId) : "") !== workflowStepDraft;
    return titleChanged || descriptionChanged || statusChanged || assigneeChanged || workflowChanged;
  }, [assigneeDraft, descriptionDraft, statusDraft, task, titleDraft, workflowStepDraft]);

  const handleSave = () => {
    if (!task) return;
    const payload: Record<string, any> = {
      title: titleDraft,
      description: descriptionDraft,
    };

    if (task.taskType !== "agent" && statusDraft) {
      payload.status = statusDraft;
    }

    if (task.taskType === "agent") {
      payload.ownerType = "agent";
      payload.workflowStepId = workflowStepDraft ? Number(workflowStepDraft) : null;
      payload.assigneeUserId = null;
    } else if (task.taskType === "human") {
      payload.ownerType = "human";
      payload.assigneeUserId = assigneeDraft ? Number(assigneeDraft) : null;
      payload.workflowStepId = null;
    }

    updateTaskMutation.mutate(payload);
  };

  const relatedDeliverables = useMemo(() => {
    if (!task?.workflowStepId) return [] as Deliverable[];
    return deliverables.filter((d) => d.stepId === task.workflowStepId);
  }, [deliverables, task?.workflowStepId]);

  const chartDeliverables = useMemo(() => {
    return relatedDeliverables.flatMap((deliverable) => {
      const { envelope } = parseDeliverableContent(deliverable.contentJson);
      const chartIds = (Array.isArray(envelope?.refs?.chartIds) ? envelope?.refs?.chartIds : []) as number[];
      return chartIds.map((chartId: number) => ({ deliverableId: deliverable.id, chartId }));
    });
  }, [relatedDeliverables]);

  const startWorkflowRun = useCallback(() => {
    if (!task?.workflowStepId || runState === "running") return;
    runStartedRef.current = true;
    setRunState("running");
    setRunMessages([]);

    if (runStreamRef.current) {
      runStreamRef.current.close();
    }

    const streamUrl = `/api/projects/${projectId}/workflow/steps/${task.workflowStepId}/run-stream`;
    const source = new EventSource(streamUrl);
    runStreamRef.current = source;

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as RunMessage;
        if (payload.type === "complete") {
          setRunMessages((prev) => [...prev, payload].slice(-10));
          setRunState("complete");
          runStartedRef.current = false;
          source.close();
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "management"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deliverables"] });
          return;
        }
        if (payload.type === "error") {
          setRunMessages((prev) => [...prev, payload].slice(-10));
          setRunState("error");
          runStartedRef.current = false;
          source.close();
          return;
        }
        setRunMessages((prev) => [...prev, payload].slice(-10));
      } catch {
        setRunMessages((prev) => [...prev, { type: "progress", content: String(event.data), timestamp: Date.now() }].slice(-10));
      }
    };

    source.onerror = () => {
      setRunMessages((prev) => [...prev, { type: "error", content: "Stream error", timestamp: Date.now() }].slice(-10));
      setRunState("error");
      runStartedRef.current = false;
      source.close();
    };
  }, [projectId, queryClient, runState, task?.workflowStepId]);

  const toggleTable = useCallback((deliverableId: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(deliverableId)) {
        next.delete(deliverableId);
      } else {
        next.add(deliverableId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!task?.workflowStepId) return;
    const shouldRun = searchParams.get("run") === "1";
    if (!shouldRun || runStartedRef.current) return;
    startWorkflowRun();
    if (shouldRun) {
      const next = new URLSearchParams(searchParams);
      next.delete("run");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, startWorkflowRun, task?.workflowStepId]);

  useEffect(() => {
    return () => {
      if (runStreamRef.current) runStreamRef.current.close();
    };
  }, []);

  if (!task) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">Task not found.</div>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate(`/project/${projectId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to network
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{task.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{task.description || "No description"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
          <Badge variant="secondary">{task.status.replace(/_/g, " ")}</Badge>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => previousTask && navigate(`/project/${projectId}/management/task/${previousTask.id}`)}
              disabled={!previousTask}
            >
              Previous task
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => nextTask && navigate(`/project/${projectId}/management/task/${nextTask.id}`)}
              disabled={!nextTask}
            >
              Next task
            </Button>
          </div>
        </div>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</div>
            <div className="mt-1 text-sm text-foreground">
              {task.ownerType === "agent" ? "Agentic workflow" : task.ownerType === "client" ? "Client" : "Human"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignee</div>
            <div className="mt-1 text-sm text-foreground">{assigneeName}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow step</div>
            <div className="mt-1 text-sm text-foreground">{workflowStepLabel}</div>
          </div>
          {workflowStatusLabel && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow status</div>
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  {workflowStatusLabel}
                </Badge>
              </div>
            </div>
          )}
          {task.workflowStepId && (
            <div className="md:col-span-2">
              <Button
                size="sm"
                variant="outline"
                onClick={startWorkflowRun}
                disabled={runState === "running"}
              >
                <Play className="h-4 w-4 mr-1" />
                {runState === "running" ? "Running" : "Run workflow"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {runState !== "idle" && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Workflow run</div>
              <p className="text-xs text-muted-foreground">
                {runState === "running"
                  ? "Running model workflow. Live updates below."
                  : runState === "complete"
                  ? "Run completed."
                  : "Run failed."}
              </p>
            </div>
            <Badge variant={runState === "error" ? "destructive" : "outline"} className="text-xs">
              {runState}
            </Badge>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${runState === "running" ? "animate-pulse bg-emerald-500" : runState === "complete" ? "bg-emerald-500" : "bg-rose-500"}`}
              style={{ width: runState === "running" ? "60%" : "100%" }}
            />
          </div>
          {runMessages.length > 0 && (
            <div className="mt-4 space-y-2">
              {runMessages.map((message, index) => (
                <div key={`${message.timestamp}-${index}`}>
                  {renderRunMessage(message)}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Task settings</div>
            <p className="text-xs text-muted-foreground">Update task metadata, ownership, and workflow linkage.</p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateTaskMutation.isPending}>
            Save changes
          </Button>
        </div>
        {updateTaskMutation.error && (
          <div className="mt-3 text-xs text-destructive">
            {updateTaskMutation.error instanceof Error ? updateTaskMutation.error.message : "Update failed."}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</label>
            <Input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
            <Select value={statusDraft} onValueChange={setStatusDraft} disabled={task.taskType === "agent"}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS[task.taskType].map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {task.taskType === "agent" && (
              <div className="mt-1 text-[11px] text-muted-foreground">Status is managed by agent runs.</div>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
            <Textarea
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>
          {task.taskType === "human" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignee</label>
              <Select value={assigneeDraft} onValueChange={setAssigneeDraft}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {task.taskType === "agent" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow step</label>
              <Select value={workflowStepDraft} onValueChange={setWorkflowStepDraft}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select workflow step" />
                </SelectTrigger>
                <SelectContent>
                  {managementData?.workflowSteps.map((step) => (
                    <SelectItem key={step.id} value={String(step.id)}>
                      {step.workflowName ? `${step.workflowName} · ${step.name}` : step.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Completed deliverables</div>
            <p className="text-xs text-muted-foreground">Deliverables generated by this task’s workflow step.</p>
          </div>
          {workflowStep && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/project/${projectId}/workflow/${workflowStep.id}`)}>
              <LinkIcon className="h-4 w-4 mr-1" />
              Open workflow step
            </Button>
          )}
        </div>

          {relatedDeliverables.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No deliverables yet.</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {relatedDeliverables.map((deliverable) => (
              <Card key={deliverable.id} className="p-3">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{deliverable.title}</div>
                    <div className="text-xs text-muted-foreground">v{deliverable.version}</div>
                    <div className="text-xs text-muted-foreground">{new Date(deliverable.createdAt).toLocaleString()}</div>
                    {deliverable.contentJson && (() => {
                      const { payload, envelope } = parseDeliverableContent(deliverable.contentJson);
                      const agentKey = workflowStepById.get(deliverable.stepId)?.agentKey || "generic";
                      const text = formatDeliverableText(agentKey, payload);
                      const tableData = extractTableData(payload);
                      const showTable = expandedTables.has(deliverable.id);
                      const refs = envelope?.refs && Object.keys(envelope.refs).length
                        ? Object.entries(envelope.refs)
                          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
                          .join(" · ")
                        : "";

                      return (
                        <div className="mt-3 space-y-2">
                          {refs && <div className="text-[10px] text-muted-foreground">{refs}</div>}
                          <FormattedText text={text} />
                          {tableData && (
                            <div className="pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => toggleTable(deliverable.id)}
                              >
                                {showTable ? "Hide table" : "View table"}
                              </Button>
                              {showTable && (
                                <div className="mt-2 border rounded-md overflow-auto max-h-64">
                                  <table className="min-w-full text-xs">
                                    <thead className="sticky top-0 bg-muted">
                                      <tr>
                                        {tableData.columns.map((col) => (
                                          <th key={col} className="text-left font-medium px-2 py-1 border-b">
                                            {col}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tableData.rows.map((row, idx) => (
                                        <tr key={idx} className="border-b last:border-b-0">
                                          {tableData.columns.map((col) => (
                                            <td key={col} className="px-2 py-1 align-top">
                                              {row[col] == null ? "" : String(row[col])}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {chartDeliverables.length > 0 && (
          <div className="mt-6">
            <div className="text-sm font-semibold text-foreground">Charts</div>
            <p className="text-xs text-muted-foreground">Charts generated from this task’s deliverables.</p>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {chartDeliverables.map(({ chartId }, index) => {
                const chart = projectCharts.find((c) => c.id === chartId);
                const rows = chartRowsById[chartId] || [];
                return (
                  <Card key={`${chartId}-${index}`} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{chart?.name || "Chart"}</div>
                        {chart?.description && (
                          <div className="text-xs text-muted-foreground">{chart.description}</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => fetchChartData(chartId)}
                      >
                        Load data
                      </Button>
                    </div>
                    <div className="mt-3 border rounded-md bg-muted/20 p-2">
                      {chart && rows.length > 0 ? (
                        <ChartRenderer config={chart.chartConfig} data={rows} height={220} showDownload={false} />
                      ) : (
                        <div className="text-xs text-muted-foreground py-6 text-center">
                          {chart ? "Load data to render chart." : "Chart metadata not found."}
                        </div>
                      )}
                    </div>
                    {chart && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Type: {chart.chartType}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
