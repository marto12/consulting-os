import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import { useUserContext } from "../lib/user-context";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { apiRequest } from "../lib/query-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../components/ui/sheet";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Circle,
  CircleSlash,
  CircleDot,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Play,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";

type ProjectPhase = {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ProjectTask = {
  id: number;
  projectId: number;
  phaseId: number | null;
  title: string;
  subtitle?: string | null;
  description: string;
  taskType?: string | null;
  ownerType: string;
  assigneeUserId?: number | null;
  assigneeIds?: number[];
  workflowStepId: number | null;
  status: string;
  dependsOn?: number[] | null;
  gateJson?: Record<string, unknown> | null;
  executionJson?: Record<string, unknown> | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type WorkflowStep = {
  id: number;
  name: string;
  status: string;
  agentKey?: string;
  workflowName?: string | null;
  workflowTemplateId?: number | null;
};

type WorkflowTemplate = {
  id: number;
  name: string;
  description?: string;
};

type ManagementData = {
  phases: ProjectPhase[];
  tasks: ProjectTask[];
  workflowSteps: WorkflowStep[];
};

type GovernanceControls = {
  promptsLocked?: boolean;
  auditLogEnabled?: boolean;
  humanSignoffRequired?: boolean;
  evalMonitoringEnabled?: boolean;
  accessControlEnabled?: boolean;
};

type ProjectDetail = {
  id: number;
  name: string;
  workflowTemplateId?: number | null;
  governanceControls?: GovernanceControls | null;
  totalSavingsToDate?: number | null;
  costReductionRealisedPct?: number | null;
  marginImpactToDate?: number | null;
  projectedAnnualImpact?: number | null;
};

type TaskType = "human" | "agent" | "client";

type TaskStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "awaiting_client"
  | "running"
  | "under_review"
  | "complete"
  | "rework_required";

type ExecutionState = "idle" | "running" | "failed" | "succeeded";

type ExecutionHistory = {
  id: string;
  state: ExecutionState;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  output?: {
    id: string;
    title: string;
    type: string;
    size?: string;
  };
};

type TaskExecution = {
  state: ExecutionState;
  lastRunAt?: string;
  lastResult?: string;
  history: ExecutionHistory[];
};

type TaskGate = {
  gateType?: string;
  clientOwner?: string;
  dueDate?: string;
};

type Task = {
  id: number;
  title: string;
  subtitle?: string;
  description: string;
  phaseId: number | null;
  taskType: TaskType;
  status: TaskStatus;
  responsibleId?: number | null;
  dependsOn: number[];
  workflowId?: number | null;
  execution?: TaskExecution;
  gate?: TaskGate;
  sortOrder: number;
};

type Phase = {
  id: number;
  name: string;
  order: number;
};

type ProjectSummary = {
  currentPhaseId: number | null;
  progressPercent: number;
  gateSummary: string;
  bottleneckLabel: string;
  bottleneckDetail: string;
  recommendedAction: string;
};

function getStatusStyles(status: TaskStatus) {
  switch (status) {
    case "complete":
      return {
        card: "border-emerald-200 bg-emerald-50",
        chip: "border-emerald-200 text-emerald-700",
      };
    case "in_progress":
      return {
        card: "border-blue-200 bg-blue-50",
        chip: "border-blue-200 text-blue-700",
      };
    case "running":
      return {
        card: "border-indigo-200 bg-indigo-50",
        chip: "border-indigo-200 text-indigo-700",
      };
    case "under_review":
      return {
        card: "border-amber-200 bg-amber-50",
        chip: "border-amber-200 text-amber-700",
      };
    case "awaiting_client":
      return {
        card: "border-sky-200 bg-sky-50",
        chip: "border-sky-200 text-sky-700",
      };
    case "blocked":
      return {
        card: "border-rose-200 bg-rose-50",
        chip: "border-rose-200 text-rose-700",
      };
    case "rework_required":
      return {
        card: "border-orange-200 bg-orange-50",
        chip: "border-orange-200 text-orange-700",
      };
    default:
      return {
        card: "border-border bg-white",
        chip: "border-border text-muted-foreground",
      };
  }
}

function getStatusMeta(status: TaskStatus) {
  switch (status) {
    case "complete":
      return { label: "Complete", Icon: CheckCircle2 };
    case "in_progress":
      return { label: "In progress", Icon: CircleDot };
    case "running":
      return { label: "Running", Icon: Zap };
    case "under_review":
      return { label: "Under review", Icon: AlertTriangle };
    case "awaiting_client":
      return { label: "Awaiting client", Icon: Circle };
    case "blocked":
      return { label: "Blocked", Icon: AlertTriangle };
    case "rework_required":
      return { label: "Rework required", Icon: CircleSlash };
    default:
      return { label: "Not started", Icon: Circle };
  }
}

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "awaiting_client", label: "Awaiting client" },
  { value: "running", label: "Running" },
  { value: "under_review", label: "Under review" },
  { value: "rework_required", label: "Rework required" },
  { value: "complete", label: "Complete" },
];

const TASK_TYPE_META: Record<
  TaskType,
  { label: string; Icon: typeof User; badge: string; tint: string }
> = {
  human: { label: "Human", Icon: User, badge: "bg-emerald-100 text-emerald-700", tint: "border-emerald-200" },
  agent: { label: "Agent", Icon: Bot, badge: "bg-indigo-100 text-indigo-700", tint: "border-indigo-200" },
  client: { label: "Client", Icon: ShieldCheck, badge: "bg-sky-100 text-sky-700", tint: "border-sky-200" },
};

const STATUS_BY_TYPE: Record<TaskType, TaskStatus[]> = {
  human: ["not_started", "in_progress", "blocked", "under_review", "rework_required", "complete"],
  agent: ["not_started", "running", "blocked", "under_review", "rework_required", "complete"],
  client: ["not_started", "awaiting_client", "under_review", "rework_required", "complete"],
};

const EXECUTION_LABELS: Record<ExecutionState, string> = {
  idle: "Idle",
  running: "Running",
  failed: "Failed",
  succeeded: "Succeeded",
};

const TASK_STATUS_SET = new Set<TaskStatus>(TASK_STATUS_OPTIONS.map((option) => option.value));

function normalizeTaskStatus(status: string): TaskStatus {
  if (status === "needs_review") return "under_review";
  if (status === "completed" || status === "complete") return "complete";
  if (TASK_STATUS_SET.has(status as TaskStatus)) return status as TaskStatus;
  return "not_started";
}

function normalizeTaskType(ownerType: string): TaskType {
  if (ownerType === "agent") return "agent";
  if (ownerType === "client") return "client";
  return "human";
}

function buildExecution(status: TaskStatus): TaskExecution {
  if (status === "running") {
    return { state: "running", lastRunAt: new Date().toISOString(), lastResult: "Running", history: [] };
  }
  return { state: "idle", history: [] };
}

function getBlockingDependencies(task: Task, taskMap: Map<number, Task>): number[] {
  return task.dependsOn.filter((depId) => {
    const dep = taskMap.get(depId);
    return !dep || dep.status !== "complete";
  });
}

function sortTasksByDependencies<T extends Task>(tasks: T[]): T[] {
  const taskMap = new Map<number, T>();
  tasks.forEach((task) => taskMap.set(task.id, task));

  const inDegree = new Map<number, number>();
  const dependents = new Map<number, number[]>();
  tasks.forEach((task) => {
    inDegree.set(task.id, 0);
    dependents.set(task.id, []);
  });

  tasks.forEach((task) => {
    task.dependsOn.forEach((depId) => {
      if (!taskMap.has(depId)) return;
      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      dependents.get(depId)?.push(task.id);
    });
  });

  const queue = tasks
    .filter((task) => (inDegree.get(task.id) || 0) === 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
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
          queue.sort((a, b) => a.sortOrder - b.sortOrder);
        }
      }
    });
  }

  if (result.length !== tasks.length) {
    const remaining = tasks
      .filter((task) => !result.find((item) => item.id === task.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    result.push(...remaining);
  }

  return result;
}

export default function ProjectManagement() {
  const { id } = useParams<{ id: string }>();
  const projectId = id ? Number(id) : NaN;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { users } = useUserContext();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [overviewView, setOverviewView] = useState<"operations" | "impact">("operations");
  const [view, setView] = useState<"list" | "board" | "timeline">("list");
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");
  const [phaseFilter, setPhaseFilter] = useState<number | "all" | "unassigned">("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<number, boolean>>({});
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [impactShowFinancials, setImpactShowFinancials] = useState(false);
  const [impactForm, setImpactForm] = useState({
    totalSavingsToDate: "",
    costReductionRealisedPct: "",
    marginImpactToDate: "",
    projectedAnnualImpact: "",
    governanceControls: {
      promptsLocked: false,
      auditLogEnabled: false,
      humanSignoffRequired: false,
      evalMonitoringEnabled: false,
      accessControlEnabled: false,
    } as Required<GovernanceControls>,
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { data: project } = useQuery<ProjectDetail>({
    queryKey: ["/api/projects", projectId],
    enabled: Number.isFinite(projectId),
  });

  const { data: workflowTemplate } = useQuery<{
    id: number;
    name: string;
    timesUsed?: number | null;
    governanceMaturity?: number | null;
    deploymentStatus?: string | null;
    baselineCost?: number | null;
    aiCost?: number | null;
  }>({
    queryKey: ["/api/workflows", project?.workflowTemplateId],
    enabled: Number.isFinite(project?.workflowTemplateId),
  });

  const saveImpactMutation = useMutation({
    mutationFn: async () => {
      const parseNumber = (value: string) => {
        const cleaned = value.replace(/[^0-9.-]/g, "");
        if (!cleaned) return null;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const payload = {
        governanceControls: impactForm.governanceControls,
        totalSavingsToDate: parseNumber(impactForm.totalSavingsToDate),
        costReductionRealisedPct: parseNumber(impactForm.costReductionRealisedPct),
        marginImpactToDate: parseNumber(impactForm.marginImpactToDate),
        projectedAnnualImpact: parseNumber(impactForm.projectedAnnualImpact),
      };
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      setToast({ message: "Impact settings saved.", type: "success" });
    },
    onError: () => {
      setToast({ message: "Failed to save impact settings.", type: "error" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: number; payload: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/tasks/${taskId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "management"] });
    },
    onError: () => {
      setToast({ message: "Failed to update task.", type: "error" });
    },
  });

  const attachWorkflowMutation = useMutation({
    mutationFn: async ({ templateId }: { templateId: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflow/attach-template`, { templateId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "management"] });
    },
    onError: () => {
      setToast({ message: "Failed to attach workflow.", type: "error" });
    },
  });

  const { data: managementData, isLoading } = useQuery<ManagementData>({
    queryKey: ["/api/projects", projectId, "management"],
    enabled: Number.isFinite(projectId),
  });

  const { data: workflowTemplates = [] } = useQuery<WorkflowTemplate[]>({
    queryKey: ["/api/workflows"],
  });

  const { data: deliverables = [] } = useQuery<
    { id: number; stepId: number; title: string; version: number; createdAt: string }[]
  >({
    queryKey: ["/api/projects", projectId, "deliverables"],
    enabled: Number.isFinite(projectId),
  });

  const phases = useMemo<Phase[]>(() => {
    return (managementData?.phases || [])
      .map((phase) => ({ id: phase.id, name: phase.title, order: phase.sortOrder }))
      .sort((a, b) => a.order - b.order);
  }, [managementData?.phases]);

  const workflowSteps = useMemo(() => managementData?.workflowSteps || [], [managementData?.workflowSteps]);
  const workflowStepMap = useMemo(() => {
    const map = new Map<number, WorkflowStep>();
    workflowSteps.forEach((step) => map.set(step.id, step));
    return map;
  }, [workflowSteps]);


  useEffect(() => {
    if (!managementData?.tasks) return;
    setLocalTasks((prev) => {
      const previousMap = new Map(prev.map((task) => [task.id, task]));
      return managementData.tasks
        .map((task) => {
          const baseTask: Task = {
            id: task.id,
            title: task.title,
            subtitle: task.subtitle || task.description || undefined,
            description: task.description || "",
            phaseId: task.phaseId ?? null,
            taskType: task.taskType ? normalizeTaskType(task.taskType) : normalizeTaskType(task.ownerType),
            status: normalizeTaskStatus(task.status),
            responsibleId: task.assigneeUserId ?? null,
            dependsOn: Array.isArray(task.dependsOn)
              ? task.dependsOn.map((id) => Number(id)).filter((id) => Number.isFinite(id))
              : [],
            workflowId: task.workflowStepId ?? null,
            execution: (task.ownerType === "agent" || task.taskType === "agent")
              ? buildExecution(normalizeTaskStatus(task.status))
              : undefined,
            gate: task.gateJson
              ? (task.gateJson as Record<string, unknown>)
              : (task.ownerType === "client" || task.taskType === "client")
                ? { gateType: "approval" }
                : undefined,
            sortOrder: task.sortOrder,
          };
          const previous = previousMap.get(task.id);
          if (!previous) return baseTask;
          return {
            ...baseTask,
            ...previous,
            title: baseTask.title,
            sortOrder: baseTask.sortOrder,
          };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }, [managementData?.tasks]);


  const taskMap = useMemo(() => {
    return new Map(localTasks.map((task) => [task.id, task]));
  }, [localTasks]);

  type ComputedTask = Task & { isBlocked: boolean; blockedByIds: number[]; blockedByLabels: string[] };

  const computedTasks = useMemo<ComputedTask[]>(() => {
    return localTasks.map((task) => {
      const blockedByIds = getBlockingDependencies(task, taskMap);
      const blockedByLabels = blockedByIds.map((id) => taskMap.get(id)?.title || "Missing task");
      return {
        ...task,
        isBlocked: blockedByIds.length > 0,
        blockedByIds,
        blockedByLabels,
      };
    });
  }, [localTasks, taskMap]);

  const computedTaskById = useMemo(() => {
    const map = new Map<number, ComputedTask>();
    computedTasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [computedTasks]);

  const selectedTask = selectedTaskId ? computedTaskById.get(selectedTaskId) ?? null : null;
  const selectedDeliverables = useMemo(() => {
    if (!selectedTask?.workflowId) return [];
    return deliverables.filter((d) => d.stepId === selectedTask.workflowId);
  }, [deliverables, selectedTask?.workflowId]);

  const phaseLookup = useMemo(() => {
    const map = new Map<number, string>();
    phases.forEach((phase) => map.set(phase.id, phase.name));
    return map;
  }, [phases]);

  const phaseOrderMap = useMemo(() => {
    const map = new Map<number, number>();
    phases.forEach((phase) => map.set(phase.id, phase.order));
    return map;
  }, [phases]);

  const tasksByPhase = useMemo(() => {
    const map = new Map<number | null, ComputedTask[]>();
    computedTasks.forEach((task) => {
      const key = task.phaseId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    });
    map.forEach((tasks, key) => {
      map.set(key, sortTasksByDependencies(tasks));
    });
    return map;
  }, [computedTasks]);

  const phaseCounts = useMemo(() => {
    const map = new Map<number | null, { done: number; total: number }>();
    computedTasks.forEach((task) => {
      const key = task.phaseId ?? null;
      if (!map.has(key)) map.set(key, { done: 0, total: 0 });
      const entry = map.get(key);
      if (!entry) return;
      entry.total += 1;
      if (task.status === "complete") entry.done += 1;
    });
    return map;
  }, [computedTasks]);

  const currentPhaseId = useMemo(() => {
    if (phases.length === 0) return null;
    for (const phase of phases) {
      const tasks = tasksByPhase.get(phase.id) || [];
      if (tasks.some((task) => task.status !== "complete")) return phase.id;
    }
    return phases[phases.length - 1]?.id ?? null;
  }, [phases, tasksByPhase]);

  useEffect(() => {
    if (Object.keys(collapsedPhases).length > 0 || phases.length === 0) return;
    const next: Record<number, boolean> = {};
    phases.forEach((phase) => {
      next[phase.id] = false;
    });
    setCollapsedPhases(next);
  }, [phases, collapsedPhases]);

  const getResponsibleLabel = useCallback(
    (task: Task) => {
      if (task.taskType === "human") {
        const user = users.find((item) => item.id === task.responsibleId);
        return user?.name || "Unassigned";
      }
      if (task.taskType === "agent") {
        const workflow = task.workflowId ? workflowStepMap.get(task.workflowId) : null;
        if (!workflow) return "Unassigned";
        return workflow.workflowName ? `${workflow.workflowName} · ${workflow.name}` : workflow.name;
      }
      return task.gate?.clientOwner || "Client";
    },
    [users, workflowStepMap]
  );

  const updateTask = useCallback((taskId: number, updater: (task: Task) => Task) => {
    setLocalTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)));
  }, []);

  const handleStatusChange = useCallback(
    (taskId: number, nextStatus: TaskStatus) => {
      setLocalTasks((prev) => {
        const map = new Map(prev.map((task) => [task.id, task]));
        return prev.map((task) => {
          if (task.id !== taskId) return task;
          if (!STATUS_BY_TYPE[task.taskType].includes(nextStatus)) return task;
          const blockedByIds = getBlockingDependencies(task, map);
          if ((nextStatus === "in_progress" || nextStatus === "running") && blockedByIds.length > 0) {
            return { ...task, status: "blocked" };
          }
          return { ...task, status: nextStatus };
        });
      });
    },
    []
  );

  const handleStatusDrop = useCallback(
    (taskId: number, nextStatus: TaskStatus) => {
      handleStatusChange(taskId, nextStatus);
    },
    [handleStatusChange]
  );

  const openTaskDrawer = useCallback((taskId: number) => {
    setSelectedTaskId(null);
    if (!Number.isFinite(projectId)) return;
    navigate(`/project/${projectId}/management/task/${taskId}`);
  }, [navigate, projectId]);

  const handleRunWorkflow = useCallback(
    (taskId: number, workflowId?: number | null) => {
      if (!workflowId) return;
      fetch(`/api/projects/${projectId}/workflow/steps/${workflowId}/run`, { method: "POST" }).catch(() => null);
      navigate(`/project/${projectId}/management/task/${taskId}`);
    },
    [navigate, projectId]
  );

  const handleDependencyAdd = useCallback((taskId: number, depId: number) => {
    updateTask(taskId, (task) => {
      if (task.dependsOn.includes(depId) || task.id === depId) return task;
      return { ...task, dependsOn: [...task.dependsOn, depId] };
    });
  }, [updateTask]);

  const handleDependencyRemove = useCallback((taskId: number, depId: number) => {
    updateTask(taskId, (task) => ({ ...task, dependsOn: task.dependsOn.filter((id) => id !== depId) }));
  }, [updateTask]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, ComputedTask[]>();
    TASK_STATUS_OPTIONS.forEach((option) => map.set(option.value, []));
    computedTasks.forEach((task) => {
      if (!map.has(task.status)) map.set(task.status, []);
      map.get(task.status)?.push(task);
    });
    return map;
  }, [computedTasks]);

  const projectSummary = useMemo<ProjectSummary>(() => {
    const totalTasks = computedTasks.length;
    const completedTasks = computedTasks.filter((task) => task.status === "complete").length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const gateTasks = computedTasks.filter((task) => task.taskType === "client");
    const awaitingClient = gateTasks.filter((task) => task.status === "awaiting_client").length;
    const underReview = gateTasks.filter((task) => task.status === "under_review").length;
    const reworkRequired = gateTasks.filter((task) => task.status === "rework_required").length;
    const gateSummaryParts = [
      awaitingClient ? `${awaitingClient} awaiting client` : null,
      underReview ? `${underReview} under review` : null,
      reworkRequired ? `${reworkRequired} rework requested` : null,
    ].filter(Boolean);
    const gateSummary = gateSummaryParts.length > 0 ? gateSummaryParts.join(" · ") : "No pending client gates";

    const sortedByPriority = [...computedTasks].sort((a, b) => {
      const phaseOrderA = a.phaseId ? phaseOrderMap.get(a.phaseId) ?? 999 : 999;
      const phaseOrderB = b.phaseId ? phaseOrderMap.get(b.phaseId) ?? 999 : 999;
      return phaseOrderA - phaseOrderB || a.sortOrder - b.sortOrder;
    });

    const blockedTask = sortedByPriority.find((task) => task.isBlocked);
    const currentPhaseTasks = currentPhaseId ? tasksByPhase.get(currentPhaseId) || [] : [];
    const nextTask = currentPhaseTasks.find((task) => task.status !== "complete");

    let bottleneckLabel = "No blockers";
    let bottleneckDetail = "Ready to execute next task.";
    let recommendedAction = "Keep executing the current phase.";

    if (blockedTask) {
      bottleneckLabel = "Blocked";
      bottleneckDetail = `Blocked by: ${blockedTask.blockedByLabels.join(", ")}`;
      recommendedAction = `Unblock ${blockedTask.title}`;
    } else if (awaitingClient > 0) {
      bottleneckLabel = "Awaiting client";
      bottleneckDetail = gateSummary;
      const nextGate = gateTasks.find((task) => task.status === "awaiting_client");
      recommendedAction = nextGate ? `Follow up on ${nextGate.title}` : "Follow up on client approvals";
    } else if (nextTask) {
      bottleneckLabel = "Next up";
      bottleneckDetail = nextTask.title;
      recommendedAction = `Start ${nextTask.title}`;
    } else {
      bottleneckLabel = "All clear";
      bottleneckDetail = "No remaining tasks in current phase.";
      recommendedAction = "Review final outputs and close the project.";
    }

    return {
      currentPhaseId,
      progressPercent,
      gateSummary,
      bottleneckLabel,
      bottleneckDetail,
      recommendedAction,
    };
  }, [computedTasks, currentPhaseId, phaseOrderMap, tasksByPhase]);

  const filteredTasksByPhase = useMemo(() => {
    const map = new Map<number | null, ComputedTask[]>();
    computedTasks.forEach((task) => {
      if (typeFilter !== "all" && task.taskType !== typeFilter) return;
      if (phaseFilter === "unassigned" && task.phaseId !== null) return;
      if (phaseFilter !== "all" && phaseFilter !== "unassigned" && task.phaseId !== phaseFilter) return;
      if (!showCompleted && task.status === "complete") return;
      if (showBlockedOnly && !task.isBlocked) return;
      const key = task.phaseId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    });
    map.forEach((tasks, key) => {
      map.set(key, sortTasksByDependencies(tasks));
    });
    return map;
  }, [computedTasks, phaseFilter, showBlockedOnly, showCompleted, typeFilter]);

  const unassignedTasks = filteredTasksByPhase.get(null) || [];

  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    if (!selectedTask) {
      setNotesDraft("");
      return;
    }
    setNotesDraft(selectedTask.description || "");
  }, [selectedTask?.id]);

  const currentPhaseName = projectSummary.currentPhaseId
    ? phaseLookup.get(projectSummary.currentPhaseId) || "Current phase"
    : "Complete";

  useEffect(() => {
    const storedView = localStorage.getItem("project-management-view");
    if (storedView === "impact") setOverviewView("impact");
  }, []);

  useEffect(() => {
    localStorage.setItem("project-management-view", overviewView);
  }, [overviewView]);

  useEffect(() => {
    const storedFinancials = localStorage.getItem("project-impact-show-financials");
    if (storedFinancials === "true") setImpactShowFinancials(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("project-impact-show-financials", `${impactShowFinancials}`);
  }, [impactShowFinancials]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);


  const currencyFormatter = useMemo(() => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }), []);

  const percentFormatter = useMemo(() => new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }), []);

  const stripNumber = useCallback((value: string) => value.replace(/[^0-9.-]/g, ""), []);
  const formatCurrencyInput = useCallback(
    (value: string) => {
      const cleaned = stripNumber(value);
      if (!cleaned) return "";
      const parsed = Number(cleaned);
      if (!Number.isFinite(parsed)) return "";
      return currencyFormatter.format(parsed);
    },
    [currencyFormatter, stripNumber]
  );
  const formatPercentInput = useCallback(
    (value: string) => {
      const cleaned = stripNumber(value);
      if (!cleaned) return "";
      let parsed = Number(cleaned);
      if (!Number.isFinite(parsed)) return "";
      if (parsed > 1) parsed = parsed / 100;
      return percentFormatter.format(parsed);
    },
    [percentFormatter, stripNumber]
  );

  useEffect(() => {
    if (!project) return;
    setImpactForm({
      totalSavingsToDate:
        project.totalSavingsToDate != null ? formatCurrencyInput(String(project.totalSavingsToDate)) : "",
      costReductionRealisedPct:
        project.costReductionRealisedPct != null ? formatPercentInput(String(project.costReductionRealisedPct)) : "",
      marginImpactToDate:
        project.marginImpactToDate != null ? formatCurrencyInput(String(project.marginImpactToDate)) : "",
      projectedAnnualImpact:
        project.projectedAnnualImpact != null ? formatCurrencyInput(String(project.projectedAnnualImpact)) : "",
      governanceControls: {
        promptsLocked: Boolean(project.governanceControls?.promptsLocked),
        auditLogEnabled: Boolean(project.governanceControls?.auditLogEnabled),
        humanSignoffRequired: Boolean(project.governanceControls?.humanSignoffRequired),
        evalMonitoringEnabled: Boolean(project.governanceControls?.evalMonitoringEnabled),
        accessControlEnabled: Boolean(project.governanceControls?.accessControlEnabled),
      },
    });
  }, [formatCurrencyInput, formatPercentInput, project]);

  const governanceControls = project?.governanceControls || {};
  const agentCompleted = computedTasks.filter((task) => task.taskType === "agent" && task.status === "complete").length;
  const humanCompleted = computedTasks.filter((task) => task.taskType === "human" && task.status === "complete").length;

  const impactSummaryItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (typeof project?.totalSavingsToDate === "number") {
      items.push({ label: "Total savings to date", value: currencyFormatter.format(project.totalSavingsToDate) });
    }
    if (typeof project?.costReductionRealisedPct === "number") {
      items.push({ label: "Cost reduction realised", value: percentFormatter.format(project.costReductionRealisedPct) });
    }
    if (typeof project?.marginImpactToDate === "number") {
      items.push({ label: "Margin impact to date", value: currencyFormatter.format(project.marginImpactToDate) });
    }
    items.push({ label: "AI workflows executed", value: String(agentCompleted) });
    items.push({ label: "Human tasks executed", value: String(humanCompleted) });
    items.push({
      label: "Governance maturity",
      value: `Level ${workflowTemplate?.governanceMaturity ?? 1}`,
    });
    items.push({
      label: "Deployment status",
      value: workflowTemplate?.deploymentStatus || "sandbox",
    });
    if (typeof project?.projectedAnnualImpact === "number") {
      items.push({ label: "Projected annual impact", value: currencyFormatter.format(project.projectedAnnualImpact) });
    }
    return items;
  }, [agentCompleted, currencyFormatter, humanCompleted, percentFormatter, project, workflowTemplate?.deploymentStatus, workflowTemplate?.governanceMaturity]);

  const impactWorkflowRows = useMemo(() => {
    if (!workflowTemplate) return [];
    return [
      {
        id: workflowTemplate.id,
        name: workflowTemplate.name,
        timesUsed: workflowTemplate.timesUsed ?? 0,
        governanceMaturity: workflowTemplate.governanceMaturity ?? 1,
        baselineCost: workflowTemplate.baselineCost ?? null,
        aiCost: workflowTemplate.aiCost ?? null,
      },
    ];
  }, [workflowTemplate]);

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Project Management</h2>
          <p className="text-sm text-muted-foreground">Orchestrate phases, agents, and client gates.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
            <span>View:</span>
            <div className="flex items-center gap-1 rounded-full bg-muted p-0.5">
              {[
                { value: "operations", label: "Operations" },
                { value: "impact", label: "Impact" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setOverviewView(tab.value as "operations" | "impact")}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                    overviewView === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {overviewView === "operations" && (
            <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1">
              {[
                { value: "list", label: "List" },
                { value: "board", label: "Board" },
                { value: "timeline", label: "Timeline" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setView(tab.value as "list" | "board" | "timeline")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-full transition-colors",
                    view === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg",
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {toast.message}
        </div>
      )}

      {overviewView === "operations" ? (
        <Card className="p-4 bg-gradient-to-br from-muted/40 via-background to-background border-border/80">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.9fr_1fr_1.1fr_1.1fr_1.2fr]">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Project</div>
              <div className="text-base font-semibold text-foreground truncate">{project?.name || "Project"}</div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Current phase</div>
              <div className="text-sm font-semibold text-foreground truncate">{currentPhaseName}</div>
              <div className="text-xs text-muted-foreground">Derived from remaining tasks</div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Progress</div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${projectSummary.progressPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground">{projectSummary.progressPercent}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Gate status</div>
              <div className="text-sm text-foreground">{projectSummary.gateSummary}</div>
              <div className="text-xs text-muted-foreground">Client approvals and review gates</div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Bottleneck</div>
              <div className="text-sm font-semibold text-foreground">{projectSummary.bottleneckLabel}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{projectSummary.bottleneckDetail}</div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Recommended next action</div>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground">
                {projectSummary.recommendedAction}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 bg-gradient-to-br from-muted/40 via-background to-background border-border/80">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {impactSummaryItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-border/60 bg-background/80 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-base font-semibold text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Governance controls</div>
                <div className="text-xs text-muted-foreground">Controls tied to compliance and review requirements.</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => saveImpactMutation.mutate()}>
                Save governance + impact
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { key: "promptsLocked", label: "Prompts locked & versioned" },
                { key: "auditLogEnabled", label: "Input/output audit log enabled" },
                { key: "humanSignoffRequired", label: "Human sign-off required" },
                { key: "evalMonitoringEnabled", label: "Evaluation monitoring enabled" },
                { key: "accessControlEnabled", label: "Access control enabled" },
              ].map((control) => {
                const enabled = Boolean(impactForm.governanceControls[control.key as keyof GovernanceControls]);
                return (
                  <div key={control.key} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    {enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-foreground">{control.label}</span>
                    <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={impactForm.governanceControls[control.key as keyof GovernanceControls] as boolean}
                        onChange={(event) =>
                          setImpactForm((prev) => ({
                            ...prev,
                            governanceControls: {
                              ...prev.governanceControls,
                              [control.key]: event.target.checked,
                            },
                          }))
                        }
                      />
                      Enabled
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total savings to date</div>
                <Input
                  inputMode="decimal"
                  value={impactForm.totalSavingsToDate}
                  onChange={(event) =>
                    setImpactForm((prev) => ({ ...prev, totalSavingsToDate: event.target.value }))
                  }
                  onFocus={(event) =>
                    setImpactForm((prev) => ({ ...prev, totalSavingsToDate: stripNumber(event.target.value) }))
                  }
                  onBlur={(event) =>
                    setImpactForm((prev) => ({ ...prev, totalSavingsToDate: formatCurrencyInput(event.target.value) }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost reduction realised %</div>
                <Input
                  inputMode="decimal"
                  value={impactForm.costReductionRealisedPct}
                  onChange={(event) =>
                    setImpactForm((prev) => ({ ...prev, costReductionRealisedPct: event.target.value }))
                  }
                  onFocus={(event) =>
                    setImpactForm((prev) => ({ ...prev, costReductionRealisedPct: stripNumber(event.target.value) }))
                  }
                  onBlur={(event) =>
                    setImpactForm((prev) => ({ ...prev, costReductionRealisedPct: formatPercentInput(event.target.value) }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Margin impact to date</div>
                <Input
                  inputMode="decimal"
                  value={impactForm.marginImpactToDate}
                  onChange={(event) =>
                    setImpactForm((prev) => ({ ...prev, marginImpactToDate: event.target.value }))
                  }
                  onFocus={(event) =>
                    setImpactForm((prev) => ({ ...prev, marginImpactToDate: stripNumber(event.target.value) }))
                  }
                  onBlur={(event) =>
                    setImpactForm((prev) => ({ ...prev, marginImpactToDate: formatCurrencyInput(event.target.value) }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projected annual impact</div>
                <Input
                  inputMode="decimal"
                  value={impactForm.projectedAnnualImpact}
                  onChange={(event) =>
                    setImpactForm((prev) => ({ ...prev, projectedAnnualImpact: event.target.value }))
                  }
                  onFocus={(event) =>
                    setImpactForm((prev) => ({ ...prev, projectedAnnualImpact: stripNumber(event.target.value) }))
                  }
                  onBlur={(event) =>
                    setImpactForm((prev) => ({ ...prev, projectedAnnualImpact: formatCurrencyInput(event.target.value) }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Workflow impact</div>
                <div className="text-xs text-muted-foreground">Operating leverage and governance by workflow.</div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={impactShowFinancials}
                  onChange={(event) => setImpactShowFinancials(event.target.checked)}
                />
                Show financials
              </label>
            </div>

            <div className="mt-4 space-y-2">
              <div
                className={cn(
                  "grid items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                  impactShowFinancials
                    ? "grid-cols-[1.6fr_120px_180px_140px_140px_160px]"
                    : "grid-cols-[2fr_140px_200px]"
                )}
              >
                <div>Workflow</div>
                <div>Times used</div>
                <div>Governance maturity</div>
                {impactShowFinancials && (
                  <>
                    <div>Baseline cost</div>
                    <div>AI-enabled cost</div>
                    <div>Savings to date</div>
                  </>
                )}
              </div>

              {impactWorkflowRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  No workflows available for this project.
                </div>
              ) : (
                impactWorkflowRows.map((row) => {
                  const baselineCost = typeof row.baselineCost === "number" ? row.baselineCost! : null;
                  const aiCost = typeof row.aiCost === "number" ? row.aiCost! : null;
                  const savingsPerRun = baselineCost != null && aiCost != null ? baselineCost - aiCost : null;
                  const savingsToDate = savingsPerRun != null ? savingsPerRun * row.timesUsed : null;
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "grid items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm",
                        impactShowFinancials
                          ? "grid-cols-[1.6fr_120px_180px_140px_140px_160px]"
                          : "grid-cols-[2fr_140px_200px]"
                      )}
                    >
                      <div className="font-semibold text-foreground truncate">{row.name}</div>
                      <div className="text-sm text-foreground">{row.timesUsed}</div>
                      <div className="text-sm text-foreground">Level {row.governanceMaturity}</div>
                      {impactShowFinancials && (
                        <>
                          <div className="text-sm text-foreground">
                            {baselineCost == null ? "" : currencyFormatter.format(baselineCost)}
                          </div>
                          <div className="text-sm text-foreground">
                            {aiCost == null ? "" : currencyFormatter.format(aiCost)}
                          </div>
                          <div className="text-sm text-foreground">
                            {savingsToDate == null ? "" : currencyFormatter.format(savingsToDate)}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      {overviewView === "operations" && (
        <>
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</div>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as TaskType | "all")}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="all">All</option>
                  <option value="human">Human</option>
                  <option value="agent">Agent</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phase</div>
                <select
                  value={phaseFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "all") {
                      setPhaseFilter("all");
                      return;
                    }
                    if (value === "unassigned") {
                      setPhaseFilter("unassigned");
                      return;
                    }
                    setPhaseFilter(Number(value));
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="all">All phases</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(event) => setShowCompleted(event.target.checked)}
                />
                Show completed
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showBlockedOnly}
                  onChange={(event) => setShowBlockedOnly(event.target.checked)}
                />
                Blocked only
              </label>
            </div>
          </Card>

          {isLoading ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Loading tasks...
            </div>
          ) : computedTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Add tasks to get started.
            </div>
          ) : view !== "list" ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              {view === "board" ? "Board view will reuse this data model next." : "Timeline view will reuse this data model next."}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-[minmax(220px,2.1fr)_140px_160px_180px_220px] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <div>Task</div>
                <div>Type</div>
                <div>Status</div>
                <div>Responsible</div>
                <div>Actions</div>
              </div>

              {phases.map((phase) => {
                const tasks = filteredTasksByPhase.get(phase.id) || [];
                const counts = phaseCounts.get(phase.id) || { done: 0, total: 0 };
                const isCollapsed = collapsedPhases[phase.id];
                const isCurrent = phase.id === currentPhaseId;
                if (tasks.length === 0) return null;
                return (
                  <Card key={phase.id} className="p-0">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedPhases((prev) => ({ ...prev, [phase.id]: !prev[phase.id] }))
                      }
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{phase.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {counts.done}/{counts.total} complete {isCurrent && "· Current phase"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 min-w-[140px]">
                          <div className="h-1.5 w-full rounded-full bg-muted">
                            <div
                              className="h-1.5 rounded-full bg-emerald-500"
                              style={{ width: `${counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground w-10 text-right">
                            {counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100)}%
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs hidden">
                          {counts.done}/{counts.total}
                        </Badge>
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y divide-border">
                        {tasks.map((task) => {
                          const typeMeta = TASK_TYPE_META[task.taskType];
                          const statusMeta = getStatusMeta(task.status);
                          const statusStyles = getStatusStyles(task.status);
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "grid grid-cols-[minmax(220px,2.1fr)_140px_160px_180px_220px] gap-3 px-4 py-3 text-sm hover:bg-muted/30 cursor-pointer transition",
                                task.status === "complete" && "opacity-50"
                              )}
                              onClick={() => openTaskDrawer(task.id)}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className={cn("font-semibold text-foreground truncate", task.status === "complete" && "line-through")}>{task.title}</div>
                                  {task.isBlocked && (
                                    <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {task.subtitle || task.description || "No description"}
                                </div>
                                {task.isBlocked && (
                                  <div className="text-[11px] text-rose-600">Blocked by: {task.blockedByLabels.join(", ")}</div>
                                )}
                              </div>
                              <div>
                                <div className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]", typeMeta.badge)}>
                                  <typeMeta.Icon className="h-3 w-3" />
                                  {typeMeta.label}
                                </div>
                              </div>
                              <div
                                onClick={(event) => event.stopPropagation()}
                                onPointerDown={(event) => event.stopPropagation()}
                              >
                                <Select
                                  value={task.status}
                                  onValueChange={(value: TaskStatus) => {
                                    handleStatusChange(task.id, value);
                                    updateTaskMutation.mutate({ taskId: task.id, payload: { status: value } });
                                  }}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "h-7 w-full min-w-[130px] rounded-full border px-2 py-0 text-[11px]",
                                      statusStyles.chip
                                    )}
                                  >
                                    <SelectValue placeholder={statusMeta.label} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_BY_TYPE[task.taskType].map((status) => {
                                      const meta = getStatusMeta(status);
                                      return (
                                        <SelectItem key={status} value={status}>
                                          <div className="flex items-center gap-2">
                                            <meta.Icon className="h-3.5 w-3.5" />
                                            <span>{meta.label}</span>
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div
                                onClick={(event) => event.stopPropagation()}
                                onPointerDown={(event) => event.stopPropagation()}
                                className="flex flex-col gap-2"
                              >
                                <Select
                                  value={task.taskType === "client" ? "client" : task.taskType === "agent" ? "agent" : task.responsibleId ? String(task.responsibleId) : ""}
                                  onValueChange={(value: string) => {
                                    if (value === "agent") {
                                      updateTask(task.id, (prev) => ({
                                        ...prev,
                                        taskType: "agent",
                                        responsibleId: null,
                                        workflowId: null,
                                        gate: prev.gate,
                                      }));
                                      updateTaskMutation.mutate({
                                        taskId: task.id,
                                        payload: {
                                          ownerType: "agent",
                                          taskType: "agent",
                                          assigneeUserId: null,
                                          workflowStepId: null,
                                        },
                                      });
                                      return;
                                    }
                                    if (value === "client") {
                                      updateTask(task.id, (prev) => ({
                                        ...prev,
                                        taskType: "client",
                                        responsibleId: null,
                                        workflowId: null,
                                        gate: { ...(prev.gate ?? {}), clientOwner: "Client" },
                                      }));
                                      updateTaskMutation.mutate({
                                        taskId: task.id,
                                        payload: {
                                          ownerType: "client",
                                          taskType: "client",
                                          gateJson: { ...(task.gate ?? {}), clientOwner: "Client" },
                                          assigneeUserId: null,
                                          workflowStepId: null,
                                        },
                                      });
                                      return;
                                    }
                                    updateTask(task.id, (prev) => ({
                                      ...prev,
                                      taskType: "human",
                                      responsibleId: value ? Number(value) : null,
                                      workflowId: null,
                                      gate: prev.gate,
                                    }));
                                    updateTaskMutation.mutate({
                                      taskId: task.id,
                                      payload: {
                                        ownerType: "human",
                                        taskType: "human",
                                        assigneeUserId: value ? Number(value) : null,
                                        workflowStepId: null,
                                      },
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-full min-w-[150px] rounded-full border px-2 py-0 text-[11px]">
                                    <SelectValue placeholder="Unassigned" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="client">
                                      <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        <span>Client</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="agent">
                                      <div className="flex items-center gap-2">
                                        <Bot className="h-3.5 w-3.5" />
                                        <span>Agent workflow</span>
                                      </div>
                                    </SelectItem>
                                    {users.map((user) => (
                                      <SelectItem key={user.id} value={String(user.id)}>
                                        <div className="flex items-center gap-2">
                                          <User className="h-3.5 w-3.5" />
                                          <span>{user.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {task.taskType === "agent" && (
                                  <div className="flex flex-col gap-2 w-full">
                                    <div className="flex items-center gap-2 w-full">
                                      <Select
                                        value={(() => {
                                          if (!task.workflowId) return "";
                                          const templateId = workflowStepMap.get(task.workflowId)?.workflowTemplateId;
                                          return templateId ? String(templateId) : "";
                                        })()}
                                        onValueChange={(value: string) => {
                                          const templateId = Number(value);
                                          if (!Number.isFinite(templateId)) return;
                                          attachWorkflowMutation.mutate(
                                            { templateId },
                                            {
                                              onSuccess: (data) => {
                                                const steps = data?.steps || [];
                                                const nextStepId = steps[0]?.id || null;
                                                updateTask(task.id, (prev) => ({
                                                  ...prev,
                                                  taskType: "agent",
                                                  workflowId: nextStepId,
                                                  responsibleId: null,
                                                }));
                                                updateTaskMutation.mutate({
                                                  taskId: task.id,
                                                  payload: {
                                                    ownerType: "agent",
                                                    workflowStepId: nextStepId,
                                                    assigneeUserId: null,
                                                  },
                                                });
                                              },
                                            }
                                          );
                                        }}
                                      >
                                        <SelectTrigger className="h-7 w-full min-w-[150px] rounded-full border px-2 py-0 text-[11px]">
                                          <SelectValue placeholder="Select workflow" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {workflowTemplates.map((template) => (
                                            <SelectItem key={template.id} value={String(template.id)}>
                                              <div className="flex items-center gap-2">
                                                <GitBranch className="h-3.5 w-3.5" />
                                                <span>{template.name}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {task.workflowId && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleRunWorkflow(task.id, task.workflowId);
                                          }}
                                          aria-label="Run workflow"
                                        >
                                          <Play className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                              </div>
                              {task.taskType !== "agent" && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openTaskDrawer(task.id);
                                    }}
                                    aria-label="Open task"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}

              {unassignedTasks.length > 0 && (
                <Card className="p-0">
                  <button
                    type="button"
                    onClick={() => setCollapsedPhases((prev) => ({ ...prev, [-1]: !prev[-1] }))}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {collapsedPhases[-1] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <div>
                        <div className="text-sm font-semibold text-foreground">Unassigned</div>
                        <div className="text-xs text-muted-foreground">{unassignedTasks.length} tasks</div>
                      </div>
                    </div>
                  </button>
                  {!collapsedPhases[-1] && (
                    <div className="divide-y divide-border">
                      {unassignedTasks.map((task) => {
                        const typeMeta = TASK_TYPE_META[task.taskType];
                        const statusMeta = getStatusMeta(task.status);
                        const statusStyles = getStatusStyles(task.status);
                        return (
                          <div
                            key={task.id}
                            className="grid grid-cols-[minmax(220px,2.1fr)_140px_160px_180px_220px] gap-3 px-4 py-3 text-sm hover:bg-muted/30 cursor-pointer"
                            onClick={() => openTaskDrawer(task.id)}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">{task.title}</div>
                              <div className="text-xs text-muted-foreground truncate">{task.subtitle || task.description || "No description"}</div>
                            </div>
                            <div>
                              <div className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]", typeMeta.badge)}>
                                <typeMeta.Icon className="h-3 w-3" />
                                {typeMeta.label}
                              </div>
                            </div>
                            <div
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <Select
                                value={task.status}
                                onValueChange={(value: TaskStatus) => {
                                  handleStatusChange(task.id, value);
                                  updateTaskMutation.mutate({ taskId: task.id, payload: { status: value } });
                                }}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-7 w-full min-w-[130px] rounded-full border px-2 py-0 text-[11px]",
                                    statusStyles.chip
                                  )}
                                >
                                  <SelectValue placeholder={statusMeta.label} />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_BY_TYPE[task.taskType].map((status) => {
                                    const meta = getStatusMeta(status);
                                    return (
                                      <SelectItem key={status} value={status}>
                                        <div className="flex items-center gap-2">
                                          <meta.Icon className="h-3.5 w-3.5" />
                                          <span>{meta.label}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <div
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                              className="flex flex-col gap-2"
                            >
                              <Select
                                value={task.taskType === "client" ? "client" : task.taskType === "agent" ? "agent" : task.responsibleId ? String(task.responsibleId) : ""}
                                onValueChange={(value: string) => {
                                  if (value === "agent") {
                                    updateTask(task.id, (prev) => ({
                                      ...prev,
                                      taskType: "agent",
                                      responsibleId: null,
                                      workflowId: null,
                                      gate: prev.gate,
                                    }));
                                    updateTaskMutation.mutate({
                                      taskId: task.id,
                                      payload: {
                                        ownerType: "agent",
                                        taskType: "agent",
                                        assigneeUserId: null,
                                        workflowStepId: null,
                                      },
                                    });
                                    return;
                                  }
                                  if (value === "client") {
                                    updateTask(task.id, (prev) => ({
                                      ...prev,
                                      taskType: "client",
                                      responsibleId: null,
                                      workflowId: null,
                                      gate: { ...(prev.gate ?? {}), clientOwner: "Client" },
                                    }));
                                    updateTaskMutation.mutate({
                                      taskId: task.id,
                                      payload: {
                                        ownerType: "client",
                                        taskType: "client",
                                        gateJson: { ...(task.gate ?? {}), clientOwner: "Client" },
                                        assigneeUserId: null,
                                        workflowStepId: null,
                                      },
                                    });
                                    return;
                                  }
                                  updateTask(task.id, (prev) => ({
                                    ...prev,
                                    taskType: "human",
                                    responsibleId: value ? Number(value) : null,
                                    workflowId: null,
                                    gate: prev.gate,
                                  }));
                                  updateTaskMutation.mutate({
                                    taskId: task.id,
                                    payload: {
                                      ownerType: "human",
                                      taskType: "human",
                                      assigneeUserId: value ? Number(value) : null,
                                      workflowStepId: null,
                                    },
                                  });
                                }}
                              >
                                <SelectTrigger className="h-7 w-full min-w-[150px] rounded-full border px-2 py-0 text-[11px]">
                                  <SelectValue placeholder="Unassigned" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="client">
                                    <div className="flex items-center gap-2">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      <span>Client</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="agent">
                                    <div className="flex items-center gap-2">
                                      <Bot className="h-3.5 w-3.5" />
                                      <span>Agent workflow</span>
                                    </div>
                                  </SelectItem>
                                  {users.map((user) => (
                                    <SelectItem key={user.id} value={String(user.id)}>
                                      <div className="flex items-center gap-2">
                                        <User className="h-3.5 w-3.5" />
                                        <span>{user.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {task.taskType === "agent" && (
                                <div className="flex flex-col gap-2 w-full">
                                  <Select
                                    value={(() => {
                                      if (!task.workflowId) return "";
                                      const templateId = workflowStepMap.get(task.workflowId)?.workflowTemplateId;
                                      return templateId ? String(templateId) : "";
                                    })()}
                                    onValueChange={(value: string) => {
                                      const templateId = Number(value);
                                      if (!Number.isFinite(templateId)) return;
                                      attachWorkflowMutation.mutate(
                                        { templateId },
                                        {
                                          onSuccess: (data) => {
                                            const steps = data?.steps || [];
                                            const nextStepId = steps[0]?.id || null;
                                            updateTask(task.id, (prev) => ({
                                              ...prev,
                                              taskType: "agent",
                                              workflowId: nextStepId,
                                              responsibleId: null,
                                            }));
                                            updateTaskMutation.mutate({
                                              taskId: task.id,
                                              payload: {
                                                ownerType: "agent",
                                                workflowStepId: nextStepId,
                                                assigneeUserId: null,
                                              },
                                            });
                                          },
                                        }
                                      );
                                    }}
                                  >
                                    <SelectTrigger className="h-7 w-full min-w-[150px] rounded-full border px-2 py-0 text-[11px]">
                                      <SelectValue placeholder="Select workflow" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {workflowTemplates.map((template) => (
                                        <SelectItem key={template.id} value={String(template.id)}>
                                          <div className="flex items-center gap-2">
                                            <GitBranch className="h-3.5 w-3.5" />
                                            <span>{template.name}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {task.taskType === "client" && (
                                <Input
                                  value={String(task.gate?.clientOwner || "Client")}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    updateTask(task.id, (prev) => ({
                                      ...prev,
                                      gate: { ...(prev.gate ?? {}), clientOwner: value },
                                    }));
                                    updateTaskMutation.mutate({
                                      taskId: task.id,
                                      payload: {
                                        ownerType: "client",
                                        gateJson: { ...(task.gate ?? {}), clientOwner: value },
                                        assigneeUserId: null,
                                        workflowStepId: null,
                                      },
                                    });
                                  }}
                                  className="h-7 text-[11px]"
                                  placeholder="Client owner"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTaskDrawer(task.id);
                                }}
                                aria-label="Open task"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </>
      )}

      <Sheet open={Boolean(selectedTaskId)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[480px]">
          {selectedTask ? (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>{selectedTask.title}</SheetTitle>
                <SheetDescription>{selectedTask.subtitle || selectedTask.description || "No description provided."}</SheetDescription>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{TASK_TYPE_META[selectedTask.taskType].label}</Badge>
                  <Badge variant="outline" className="text-xs">{getStatusMeta(selectedTask.status).label}</Badge>
                  {selectedTask.taskType === "agent" && (
                    <Badge variant="secondary" className="text-xs">
                      {EXECUTION_LABELS[selectedTask.execution?.state || "idle"]}
                    </Badge>
                  )}
                </div>
              </SheetHeader>

              <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
                <div className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Details
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsible</div>
                  <select
                    value={selectedTask.taskType === "client" ? "client" : selectedTask.taskType === "agent" ? "agent" : selectedTask.responsibleId ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "agent") {
                        updateTask(selectedTask.id, (task) => ({
                          ...task,
                          taskType: "agent",
                          responsibleId: null,
                          workflowId: null,
                        }));
                        updateTaskMutation.mutate({
                          taskId: selectedTask.id,
                          payload: {
                            ownerType: "agent",
                            taskType: "agent",
                            assigneeUserId: null,
                            workflowStepId: null,
                          },
                        });
                        return;
                      }
                      if (value === "client") {
                        updateTask(selectedTask.id, (task) => ({
                          ...task,
                          taskType: "client",
                          responsibleId: null,
                          workflowId: null,
                          gate: { ...(task.gate ?? {}), clientOwner: "Client" },
                        }));
                        updateTaskMutation.mutate({
                          taskId: selectedTask.id,
                          payload: {
                            ownerType: "client",
                            taskType: "client",
                            gateJson: { ...(selectedTask.gate ?? {}), clientOwner: "Client" },
                            assigneeUserId: null,
                            workflowStepId: null,
                          },
                        });
                        return;
                      }
                      updateTask(selectedTask.id, (task) => ({
                        ...task,
                        taskType: "human",
                        responsibleId: value ? Number(value) : null,
                      }));
                      updateTaskMutation.mutate({
                        taskId: selectedTask.id,
                        payload: {
                          ownerType: "human",
                          taskType: "human",
                          assigneeUserId: value ? Number(value) : null,
                          workflowStepId: null,
                        },
                      });
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="client">Client</option>
                    <option value="agent">Agent workflow</option>
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  {selectedTask.taskType === "agent" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={(() => {
                            if (!selectedTask.workflowId) return "";
                            const templateId = workflowStepMap.get(selectedTask.workflowId)?.workflowTemplateId;
                            return templateId ? String(templateId) : "";
                          })()}
                          onChange={(event) => {
                            const value = event.target.value;
                            const templateId = Number(value);
                            if (!Number.isFinite(templateId)) return;
                            attachWorkflowMutation.mutate(
                              { templateId },
                              {
                                onSuccess: (data) => {
                                  const steps = data?.steps || [];
                                  const nextStepId = steps[0]?.id || null;
                                  updateTask(selectedTask.id, (task) => ({
                                    ...task,
                                    taskType: "agent",
                                    workflowId: nextStepId,
                                    responsibleId: null,
                                  }));
                                  updateTaskMutation.mutate({
                                    taskId: selectedTask.id,
                                    payload: {
                                      ownerType: "agent",
                                      workflowStepId: nextStepId,
                                      assigneeUserId: null,
                                    },
                                  });
                                },
                              }
                            );
                          }}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select workflow</option>
                          {workflowTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                        {selectedTask.workflowId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            onClick={() => handleRunWorkflow(selectedTask.id, selectedTask.workflowId)}
                            aria-label="Run workflow"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedTask.taskType === "client" && (
                    <Input
                      value={selectedTask.gate?.clientOwner || ""}
                      onChange={(event) =>
                        updateTask(selectedTask.id, (task) => ({
                          ...task,
                          gate: { ...task.gate, clientOwner: event.target.value },
                        }))
                      }
                      placeholder="Client owner"
                    />
                  )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phase</div>
                      <select
                        value={selectedTask.phaseId ?? ""}
                        onChange={(event) =>
                          updateTask(selectedTask.id, (task) => ({
                            ...task,
                            phaseId: event.target.value ? Number(event.target.value) : null,
                          }))
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {phases.map((phase) => (
                          <option key={phase.id} value={phase.id}>
                            {phase.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                      <select
                        value={selectedTask.status}
                        onChange={(event) => handleStatusChange(selectedTask.id, event.target.value as TaskStatus)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {STATUS_BY_TYPE[selectedTask.taskType].map((status) => (
                          <option key={status} value={status}>
                            {getStatusMeta(status).label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dependencies</div>
                    <select
                      value=""
                      onChange={(event) =>
                        event.target.value && handleDependencyAdd(selectedTask.id, Number(event.target.value))
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Add dependency</option>
                      {computedTasks
                        .filter((task) => task.id !== selectedTask.id)
                        .map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                    </select>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.dependsOn.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No dependencies</span>
                      ) : (
                        selectedTask.dependsOn.map((depId) => (
                          <Badge key={depId} variant="outline" className="flex items-center gap-1 text-xs">
                            {taskMap.get(depId)?.title || "Missing task"}
                            <button
                              type="button"
                              onClick={() => handleDependencyRemove(selectedTask.id, depId)}
                              className="text-muted-foreground"
                            >
                              ×
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">Notes</div>
                    <Textarea
                      value={notesDraft}
                      onChange={(event) => setNotesDraft(event.target.value)}
                      rows={5}
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateTask(selectedTask.id, (task) => ({
                            ...task,
                            description: notesDraft,
                            subtitle: notesDraft,
                          }))
                        }
                      >
                        Save notes
                      </Button>
                    </div>
                  </div>

                  {selectedTask.taskType === "agent" && (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-foreground">Inputs mapping</div>
                      <Textarea rows={3} placeholder="Map inputs to workflow variables" />
                    </div>
                  )}
                </div>
              </div>
          ) : (
            <div className="text-sm text-muted-foreground">Loading task details...</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
