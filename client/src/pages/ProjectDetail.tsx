import { useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import {
  ChevronLeft,
  Layers,
  GitBranch,
  FileText,
  FolderOpen,
  Activity,
  CheckCircle,
  PlayCircle,
  Loader2,
  Circle,
  Clock,
  Check,
  Bot,
  ChevronRight,
  Terminal,
  Lock,
  Upload,
  Trash2,
  Download,
  Search,
  File,
  AlertCircle,
  CheckCircle2,
  Archive,
  ListChecks,
  Pencil,
  Save,
  X,
  ArrowUp,
  ArrowDown,
  User,
  Plus,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

const STAGE_LABELS: Record<string, string> = {
  created: "New",
  definition_draft: "Definition Draft",
  definition_approved: "Definition Approved",
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

const AGENT_COLORS: Record<string, string> = {
  project_definition: "#6B7280",
  issues_tree: "#6B7280",
  mece_critic: "#9CA3AF",
  hypothesis: "#6B7280",
  execution: "#6B7280",
  summary: "#9CA3AF",
  presentation: "#6B7280",
};

interface WorkflowStep {
  id: number;
  workflowInstanceId: number;
  stepOrder: number;
  name: string;
  agentKey: string;
  status: string;
  outputSummary: any;
}

interface WorkflowData {
  instance: { id: number; currentStepOrder: number; status: string } | null;
  steps: WorkflowStep[];
}

interface Deliverable {
  id: number;
  projectId: number;
  stepId: number;
  title: string;
  contentJson: any;
  version: number;
  locked: boolean;
  createdAt: string;
}

interface RunLog {
  id: number;
  stage: string;
  status: string;
  modelUsed: string;
  errorText: string | null;
  createdAt: string;
}

interface VaultFile {
  id: number;
  projectId: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  extractedText: string | null;
  embeddingStatus: string;
  chunkCount: number;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface ProjectPhase {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectTask {
  id: number;
  projectId: number;
  phaseId: number | null;
  title: string;
  description: string;
  ownerType: string;
  assigneeUserId: number | null;
  workflowStepId: number | null;
  status: string;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectCheckpoint {
  id: number;
  projectId: number;
  phaseId: number | null;
  title: string;
  description: string;
  status: string;
  linkedDeliverableId: number | null;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ManagementData {
  phases: ProjectPhase[];
  tasks: ProjectTask[];
  checkpoints: ProjectCheckpoint[];
  workflowSteps: WorkflowStep[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="success" className="gap-1"><CheckCircle2 size={10} />Ready</Badge>;
    case "no_embeddings":
      return <Badge variant="success" className="gap-1"><CheckCircle2 size={10} />Ready (keyword)</Badge>;
    case "processing":
      return <Badge variant="default" className="gap-1"><Loader2 size={10} className="animate-spin" />Processing</Badge>;
    case "failed":
      return <Badge variant="destructive" className="gap-1"><AlertCircle size={10} />Failed</Badge>;
    default:
      return <Badge variant="secondary" className="gap-1"><Clock size={10} />Pending</Badge>;
  }
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("text/") || mimeType.includes("pdf") || mimeType.includes("document"))
    return <FileText size={20} className="text-muted-foreground" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel"))
    return <FileText size={20} className="text-muted-foreground" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return <FileText size={20} className="text-muted-foreground" />;
  return <File size={20} className="text-muted-foreground" />;
}

const PHASE_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
];

const TASK_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
];

const CHECKPOINT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "ready", label: "Ready" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes Requested" },
];

function getStatusVariant(status: string): "success" | "warning" | "destructive" | "default" | "secondary" {
  if (status === "approved" || status === "complete" || status === "completed") return "success";
  if (status === "in_progress" || status === "ready") return "warning";
  if (status === "blocked" || status === "changes_requested" || status === "failed") return "destructive";
  if (status === "not_started" || status === "pending") return "secondary";
  return "default";
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const { data: project, isLoading } = useQuery<any>({
    queryKey: ["/api/projects", projectId],
    refetchInterval: 3000,
  });

  const { data: workflowData } = useQuery<WorkflowData>({
    queryKey: ["/api/projects", projectId, "workflow"],
    refetchInterval: 3000,
  });

  const { data: deliverables } = useQuery<Deliverable[]>({
    queryKey: ["/api/projects", projectId, "deliverables"],
    refetchInterval: 5000,
  });

  const { data: logs } = useQuery<RunLog[]>({
    queryKey: ["/api/projects", projectId, "logs"],
    refetchInterval: 5000,
  });

  const { data: vaultFiles } = useQuery<VaultFile[]>({
    queryKey: ["/api/projects", projectId, "vault"],
    refetchInterval: 5000,
  });

  const { data: managementData } = useQuery<ManagementData>({
    queryKey: ["/api/projects", projectId, "management"],
    refetchInterval: 5000,
  });

  const [vaultSearch, setVaultSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  const [newPhaseDescription, setNewPhaseDescription] = useState("");
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [phaseDraft, setPhaseDraft] = useState<{ title: string; description: string; status: string }>({
    title: "",
    description: "",
    status: "not_started",
  });

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ title: string; description: string; ownerType: string; status: string; workflowStepId: number | null }>({
    title: "",
    description: "",
    ownerType: "human",
    status: "not_started",
    workflowStepId: null,
  });

  const [editingCheckpointId, setEditingCheckpointId] = useState<number | null>(null);
  const [checkpointDraft, setCheckpointDraft] = useState<{ title: string; description: string; status: string }>({
    title: "",
    description: "",
    status: "pending",
  });

  const [newTaskDraftByPhase, setNewTaskDraftByPhase] = useState<Record<number, { title: string; description: string; ownerType: string; workflowStepId: number | null }>>({});
  const [newCheckpointTitle, setNewCheckpointTitle] = useState("");
  const [newCheckpointDescription, setNewCheckpointDescription] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/vault/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "vault"] });
      setUploading(false);
    },
    onError: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/vault/${fileId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "vault"] });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = "";
    }
  };

  const filteredVaultFiles = (vaultFiles || []).filter((f) =>
    f.fileName.toLowerCase().includes(vaultSearch.toLowerCase())
  );

  const runStep = (stepId: number) => {
    navigate(`/project/${projectId}/workflow/${stepId}?autorun=true`);
  };

  const approveStepMutation = useMutation({
    mutationFn: async (stepId: number) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflow/steps/${stepId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deliverables"] });
    },
  });

  const invalidateManagement = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "management"] });
  };

  const createPhaseMutation = useMutation({
    mutationFn: async (payload: { title: string; description: string; status: string; sortOrder: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/phases`, payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateManagement();
      setNewPhaseTitle("");
      setNewPhaseDescription("");
    },
  });

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/phases/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateManagement();
      setEditingPhaseId(null);
    },
  });

  const deletePhaseMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/phases/${id}`);
      return id;
    },
    onSuccess: () => invalidateManagement(),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tasks`, payload);
      return res.json();
    },
    onSuccess: () => invalidateManagement(),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/tasks/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateManagement();
      setEditingTaskId(null);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/tasks/${id}`);
      return id;
    },
    onSuccess: () => invalidateManagement(),
  });

  const createCheckpointMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/checkpoints`, payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateManagement();
      setNewCheckpointTitle("");
      setNewCheckpointDescription("");
    },
  });

  const updateCheckpointMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/checkpoints/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateManagement();
      setEditingCheckpointId(null);
    },
  });

  const deleteCheckpointMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/checkpoints/${id}`);
      return id;
    },
    onSuccess: () => invalidateManagement(),
  });

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-72" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Card className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="mt-5">
            <Skeleton className="h-2 w-full" />
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-5/6" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-4/6" />
          </Card>
        </div>
      </div>
    );
  }

  const steps = workflowData?.steps || [];
  
  const managementPhases = managementData?.phases || [];
  const managementTasks = managementData?.tasks || [];
  const managementCheckpoints = managementData?.checkpoints || [];

  const workflowStepMap = useMemo(() => {
    const map = new Map<number, WorkflowStep>();
    (managementData?.workflowSteps || steps).forEach((s) => map.set(s.id, s));
    return map;
  }, [managementData?.workflowSteps, steps]);

  const tasksByPhase = useMemo(() => {
    const map = new Map<number, ProjectTask[]>();
    managementTasks.forEach((t) => {
      if (!t.phaseId) return;
      const list = map.get(t.phaseId) || [];
      list.push(t);
      map.set(t.phaseId, list);
    });
    return map;
  }, [managementTasks]);

  const checkpointsByPhase = useMemo(() => {
    const map = new Map<number, ProjectCheckpoint[]>();
    managementCheckpoints.forEach((c) => {
      if (!c.phaseId) return;
      const list = map.get(c.phaseId) || [];
      list.push(c);
      map.set(c.phaseId, list);
    });
    return map;
  }, [managementCheckpoints]);

  function getEffectiveTaskStatus(task: ProjectTask): string {
    if (task.ownerType === "agent" && task.workflowStepId) {
      const step = workflowStepMap.get(task.workflowStepId);
      if (step) return step.status;
    }
    return task.status;
  }

  function getPhaseProgress(phaseId: number): { done: number; total: number } {
    const tasks = tasksByPhase.get(phaseId) || [];
    if (tasks.length === 0) return { done: 0, total: 0 };
    const done = tasks.filter((t) => {
      const status = getEffectiveTaskStatus(t);
      if (t.ownerType === "agent") return status === "approved";
      return status === "completed";
    }).length;
    return { done, total: tasks.length };
  }

  function getStepStatusInfo(step: WorkflowStep) {
    if (step.status === "completed" || step.status === "approved") {
      return { icon: <CheckCircle size={16} />, color: "text-foreground", label: step.status === "approved" ? "Approved" : "Completed" };
    }
    if (step.status === "awaiting_confirmation") {
      return { icon: <Circle size={16} />, color: "text-amber-500", label: "Needs Confirmation" };
    }
    if (step.status === "running") {
      return { icon: <Loader2 size={16} className="animate-spin" />, color: "text-muted-foreground", label: "Running" };
    }
    if (step.status === "failed") {
      return { icon: <Circle size={16} />, color: "text-destructive", label: "Failed" };
    }
    return { icon: <Circle size={16} />, color: "text-muted-foreground", label: "Not Started" };
  }

  function canRunStep(step: WorkflowStep, idx: number): boolean {
    if (step.status === "running") return false;
    if (step.status === "approved") return false;
    if (step.status === "awaiting_confirmation") return false;
    if (idx === 0) return step.status === "not_started" || step.status === "failed";
    const prevStep = steps[idx - 1];
    return (prevStep.status === "completed" || prevStep.status === "approved") &&
      (step.status === "not_started" || step.status === "failed");
  }

  function canApproveStep(step: WorkflowStep): boolean {
    return step.status === "completed";
  }

  function startEditPhase(phase: ProjectPhase) {
    setEditingPhaseId(phase.id);
    setPhaseDraft({ title: phase.title, description: phase.description, status: phase.status });
  }

  function startEditTask(task: ProjectTask) {
    setEditingTaskId(task.id);
    setTaskDraft({
      title: task.title,
      description: task.description,
      ownerType: task.ownerType,
      status: task.status,
      workflowStepId: task.workflowStepId || null,
    });
  }

  function startEditCheckpoint(checkpoint: ProjectCheckpoint) {
    setEditingCheckpointId(checkpoint.id);
    setCheckpointDraft({
      title: checkpoint.title,
      description: checkpoint.description,
      status: checkpoint.status,
    });
  }

  function movePhase(phaseId: number, direction: -1 | 1) {
    const sorted = [...managementPhases].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((p) => p.id === phaseId);
    if (idx < 0) return;
    const swap = sorted[idx + direction];
    if (!swap) return;
    updatePhaseMutation.mutate({ id: phaseId, payload: { sortOrder: swap.sortOrder } });
    updatePhaseMutation.mutate({ id: swap.id, payload: { sortOrder: sorted[idx].sortOrder } });
  }

  function moveTask(taskId: number, phaseId: number | null, direction: -1 | 1) {
    const tasks = (phaseId ? tasksByPhase.get(phaseId) : managementTasks.filter((t) => !t.phaseId)) || [];
    const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((t) => t.id === taskId);
    if (idx < 0) return;
    const swap = sorted[idx + direction];
    if (!swap) return;
    updateTaskMutation.mutate({ id: taskId, payload: { sortOrder: swap.sortOrder } });
    updateTaskMutation.mutate({ id: swap.id, payload: { sortOrder: sorted[idx].sortOrder } });
  }

  function moveCheckpoint(checkpointId: number, phaseId: number | null, direction: -1 | 1) {
    const checkpoints = (phaseId ? checkpointsByPhase.get(phaseId) : managementCheckpoints.filter((c) => !c.phaseId)) || [];
    const sorted = [...checkpoints].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((c) => c.id === checkpointId);
    if (idx < 0) return;
    const swap = sorted[idx + direction];
    if (!swap) return;
    updateCheckpointMutation.mutate({ id: checkpointId, payload: { sortOrder: swap.sortOrder } });
    updateCheckpointMutation.mutate({ id: swap.id, payload: { sortOrder: sorted[idx].sortOrder } });
  }

  return (
    <div className="min-w-0 w-full">
      <div className="mb-4 sm:mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="mb-2">
          <ChevronLeft size={16} />
          Back
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant={project.stage === "complete" ? "success" : "default"}>
              {STAGE_LABELS[project.stage] || project.stage}
            </Badge>
            <span className="text-xs sm:text-sm text-muted-foreground line-clamp-2 break-words">{project.objective}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="management">
        <div className="overflow-x-auto scrollbar-none pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsList className="w-max">
            <TabsTrigger value="management" className="text-xs sm:text-sm px-2.5 sm:px-3"><ListChecks size={14} className="mr-1 sm:mr-1.5" />Management</TabsTrigger>
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-2.5 sm:px-3"><Layers size={14} className="mr-1 sm:mr-1.5" />Overview</TabsTrigger>
            <TabsTrigger value="workflow" className="text-xs sm:text-sm px-2.5 sm:px-3"><GitBranch size={14} className="mr-1 sm:mr-1.5" />Workflow</TabsTrigger>
            <TabsTrigger value="deliverables" className="text-xs sm:text-sm px-2.5 sm:px-3"><FileText size={14} className="mr-1 sm:mr-1.5" />Deliverables</TabsTrigger>
            <TabsTrigger value="vault" className="text-xs sm:text-sm px-2.5 sm:px-3"><Archive size={14} className="mr-1 sm:mr-1.5" />Vault</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm px-2.5 sm:px-3"><Activity size={14} className="mr-1 sm:mr-1.5" />Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="management" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-semibold">Project Phases</h3>
                    <p className="text-xs text-muted-foreground">Editable timeline that blends agentic workflows and human tasks.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="New phase title"
                      value={newPhaseTitle}
                      onChange={(e) => setNewPhaseTitle(e.target.value)}
                      className="h-8 w-48"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!newPhaseTitle.trim()) return;
                        const sortOrder = managementPhases.length;
                        createPhaseMutation.mutate({
                          title: newPhaseTitle.trim(),
                          description: newPhaseDescription.trim(),
                          status: "not_started",
                          sortOrder,
                        });
                      }}
                    >
                      <Plus size={14} />
                      Add Phase
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="Optional phase description"
                  value={newPhaseDescription}
                  onChange={(e) => setNewPhaseDescription(e.target.value)}
                  rows={2}
                  className="mb-4"
                />

                <div className="space-y-4">
                  {managementPhases.map((phase) => {
                    const progress = getPhaseProgress(phase.id);
                    const phaseTasks = tasksByPhase.get(phase.id) || [];
                    const phaseCheckpoints = checkpointsByPhase.get(phase.id) || [];

                    const draft = newTaskDraftByPhase[phase.id] || {
                      title: "",
                      description: "",
                      ownerType: "human",
                      workflowStepId: null,
                    };

                    return (
                      <Card key={`phase-${phase.id}`} className="p-4 border border-border/80">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {editingPhaseId === phase.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={phaseDraft.title}
                                  onChange={(e) => setPhaseDraft((prev) => ({ ...prev, title: e.target.value }))}
                                />
                                <Textarea
                                  value={phaseDraft.description}
                                  onChange={(e) => setPhaseDraft((prev) => ({ ...prev, description: e.target.value }))}
                                  rows={2}
                                />
                                <Select
                                  value={phaseDraft.status}
                                  onValueChange={(value) => setPhaseDraft((prev) => ({ ...prev, status: value }))}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PHASE_STATUS_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-sm truncate">{phase.title}</h4>
                                  <Badge variant={getStatusVariant(phase.status)}>{phase.status.replace("_", " ")}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{phase.description || "No description"}</p>
                                <div className="flex items-center gap-2 mt-3">
                                  <Progress value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100} className="flex-1 h-2" />
                                  <span className="text-xs text-muted-foreground">
                                    {progress.done}/{progress.total} done
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => movePhase(phase.id, -1)}>
                              <ArrowUp size={14} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => movePhase(phase.id, 1)}>
                              <ArrowDown size={14} />
                            </Button>
                            {editingPhaseId === phase.id ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => updatePhaseMutation.mutate({ id: phase.id, payload: phaseDraft })}
                                >
                                  <Save size={14} />
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingPhaseId(null)}>
                                  <X size={14} />
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => startEditPhase(phase)}>
                                  <Pencil size={14} />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-400"
                                  onClick={() => deletePhaseMutation.mutate(phase.id)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Tasks</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (!draft.title.trim()) return;
                                createTaskMutation.mutate({
                                  title: draft.title.trim(),
                                  description: draft.description.trim(),
                                  phaseId: phase.id,
                                  ownerType: draft.ownerType,
                                  workflowStepId: draft.ownerType === "agent" ? draft.workflowStepId : null,
                                  status: draft.ownerType === "agent" ? "not_started" : "not_started",
                                  sortOrder: phaseTasks.length,
                                });
                                setNewTaskDraftByPhase((prev) => ({
                                  ...prev,
                                  [phase.id]: { title: "", description: "", ownerType: draft.ownerType, workflowStepId: null },
                                }));
                              }}
                            >
                              <Plus size={14} />
                              Add Task
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {phaseTasks.map((task) => {
                              const effectiveStatus = getEffectiveTaskStatus(task);
                              const step = task.workflowStepId ? workflowStepMap.get(task.workflowStepId) : null;
                              const stepIndex = step ? steps.findIndex((s) => s.id === step.id) : -1;
                              const showRun = step && stepIndex >= 0 && canRunStep(step, stepIndex);
                              const showApprove = step && canApproveStep(step);

                              return (
                                <div key={`task-${task.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-3">
                                  <div className="flex-1 min-w-0">
                                    {editingTaskId === task.id ? (
                                      <div className="space-y-2">
                                        <Input
                                          value={taskDraft.title}
                                          onChange={(e) => setTaskDraft((prev) => ({ ...prev, title: e.target.value }))}
                                        />
                                        <Textarea
                                          value={taskDraft.description}
                                          onChange={(e) => setTaskDraft((prev) => ({ ...prev, description: e.target.value }))}
                                          rows={2}
                                        />
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Select
                                            value={taskDraft.ownerType}
                                            onValueChange={(value) => setTaskDraft((prev) => ({ ...prev, ownerType: value }))}
                                          >
                                            <SelectTrigger className="w-32">
                                              <SelectValue placeholder="Owner" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="human">Human</SelectItem>
                                              <SelectItem value="agent">Agent</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          {taskDraft.ownerType === "human" && (
                                            <Select
                                              value={taskDraft.status}
                                              onValueChange={(value) => setTaskDraft((prev) => ({ ...prev, status: value }))}
                                            >
                                              <SelectTrigger className="w-40">
                                                <SelectValue placeholder="Status" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {TASK_STATUS_OPTIONS.map((opt) => (
                                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          )}
                                          {taskDraft.ownerType === "agent" && (
                                            <Select
                                              value={taskDraft.workflowStepId ? String(taskDraft.workflowStepId) : ""}
                                              onValueChange={(value) => setTaskDraft((prev) => ({ ...prev, workflowStepId: value ? Number(value) : null }))}
                                            >
                                              <SelectTrigger className="w-52">
                                                <SelectValue placeholder="Link workflow step" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {(managementData?.workflowSteps || steps).map((s) => (
                                                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm truncate">{task.title}</span>
                                          <Badge variant={task.ownerType === "agent" ? "default" : "secondary"} className="gap-1">
                                            {task.ownerType === "agent" ? <Bot size={12} /> : <User size={12} />}
                                            {task.ownerType === "agent" ? "Agent" : "Human"}
                                          </Badge>
                                          <Badge variant={getStatusVariant(effectiveStatus)}>{effectiveStatus.replace("_", " ")}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{task.description || "No description"}</p>
                                        {step && (
                                          <p className="text-[11px] text-muted-foreground mt-1">Linked workflow step: {step.name}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => moveTask(task.id, task.phaseId, -1)}>
                                      <ArrowUp size={14} />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => moveTask(task.id, task.phaseId, 1)}>
                                      <ArrowDown size={14} />
                                    </Button>
                                    {editingTaskId === task.id ? (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => updateTaskMutation.mutate({
                                            id: task.id,
                                            payload: {
                                              title: taskDraft.title,
                                              description: taskDraft.description,
                                              ownerType: taskDraft.ownerType,
                                              status: taskDraft.status,
                                              workflowStepId: taskDraft.ownerType === "agent" ? taskDraft.workflowStepId : null,
                                            },
                                          })}
                                        >
                                          <Save size={14} />
                                          Save
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingTaskId(null)}>
                                          <X size={14} />
                                          Cancel
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button size="sm" variant="ghost" onClick={() => startEditTask(task)}>
                                          <Pencil size={14} />
                                          Edit
                                        </Button>
                                        {task.ownerType === "human" && (
                                          <Select
                                            value={task.status}
                                            onValueChange={(value) => updateTaskMutation.mutate({ id: task.id, payload: { status: value } })}
                                          >
                                            <SelectTrigger className="w-32 h-8">
                                              <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {TASK_STATUS_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        )}
                                        {step && (
                                          <div className="flex items-center gap-1">
                                            {showRun && (
                                              <Button size="sm" onClick={() => runStep(step.id)}>
                                                <PlayCircle size={14} />
                                                Run
                                              </Button>
                                            )}
                                            {step.status === "running" && (
                                              <Button size="sm" variant="ghost" onClick={() => navigate(`/project/${projectId}/workflow/${step.id}`)}>
                                                <Loader2 size={14} className="animate-spin" />
                                                Progress
                                              </Button>
                                            )}
                                            {showApprove && (
                                              <Button size="sm" variant="outline" onClick={() => approveStepMutation.mutate(step.id)}>
                                                <Check size={14} />
                                                Approve
                                              </Button>
                                            )}
                                          </div>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-red-500 hover:text-red-400"
                                          onClick={() => deleteTaskMutation.mutate(task.id)}
                                        >
                                          <Trash2 size={14} />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            <div className="rounded-lg border border-dashed border-border/60 p-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <Input
                                  placeholder="Task title"
                                  value={draft.title}
                                  onChange={(e) => setNewTaskDraftByPhase((prev) => ({
                                    ...prev,
                                    [phase.id]: { ...draft, title: e.target.value },
                                  }))}
                                />
                                <Input
                                  placeholder="Task description"
                                  value={draft.description}
                                  onChange={(e) => setNewTaskDraftByPhase((prev) => ({
                                    ...prev,
                                    [phase.id]: { ...draft, description: e.target.value },
                                  }))}
                                />
                                <Select
                                  value={draft.ownerType}
                                  onValueChange={(value) => setNewTaskDraftByPhase((prev) => ({
                                    ...prev,
                                    [phase.id]: { ...draft, ownerType: value, workflowStepId: null },
                                  }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Owner" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="human">Human</SelectItem>
                                    <SelectItem value="agent">Agent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {draft.ownerType === "agent" && (
                                <div className="mt-2">
                                  <Select
                                    value={draft.workflowStepId ? String(draft.workflowStepId) : ""}
                                    onValueChange={(value) => setNewTaskDraftByPhase((prev) => ({
                                      ...prev,
                                      [phase.id]: { ...draft, workflowStepId: value ? Number(value) : null },
                                    }))}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Link workflow step" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(managementData?.workflowSteps || steps).map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>

                          {phaseCheckpoints.length > 0 && (
                            <div className="mt-4">
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">Phase Checkpoints</span>
                              <div className="mt-2 space-y-2">
                                {phaseCheckpoints.map((checkpoint) => (
                                  <div key={`checkpoint-${checkpoint.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-3">
                                    <div className="flex-1 min-w-0">
                                      {editingCheckpointId === checkpoint.id ? (
                                        <div className="space-y-2">
                                          <Input
                                            value={checkpointDraft.title}
                                            onChange={(e) => setCheckpointDraft((prev) => ({ ...prev, title: e.target.value }))}
                                          />
                                          <Textarea
                                            value={checkpointDraft.description}
                                            onChange={(e) => setCheckpointDraft((prev) => ({ ...prev, description: e.target.value }))}
                                            rows={2}
                                          />
                                          <Select
                                            value={checkpointDraft.status}
                                            onValueChange={(value) => setCheckpointDraft((prev) => ({ ...prev, status: value }))}
                                          >
                                            <SelectTrigger className="w-40">
                                              <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {CHECKPOINT_STATUS_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      ) : (
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm truncate">{checkpoint.title}</span>
                                            <Badge variant={getStatusVariant(checkpoint.status)}>{checkpoint.status.replace("_", " ")}</Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground mt-1">{checkpoint.description || "No description"}</p>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => moveCheckpoint(checkpoint.id, checkpoint.phaseId, -1)}>
                                        <ArrowUp size={14} />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => moveCheckpoint(checkpoint.id, checkpoint.phaseId, 1)}>
                                        <ArrowDown size={14} />
                                      </Button>
                                      {editingCheckpointId === checkpoint.id ? (
                                        <>
                                          <Button size="sm" onClick={() => updateCheckpointMutation.mutate({ id: checkpoint.id, payload: checkpointDraft })}>
                                            <Save size={14} />
                                            Save
                                          </Button>
                                          <Button size="sm" variant="ghost" onClick={() => setEditingCheckpointId(null)}>
                                            <X size={14} />
                                            Cancel
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button size="sm" variant="ghost" onClick={() => startEditCheckpoint(checkpoint)}>
                                            <Pencil size={14} />
                                            Edit
                                          </Button>
                                          <Select
                                            value={checkpoint.status}
                                            onValueChange={(value) => updateCheckpointMutation.mutate({ id: checkpoint.id, payload: { status: value } })}
                                          >
                                            <SelectTrigger className="w-36 h-8">
                                              <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {CHECKPOINT_STATUS_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-500 hover:text-red-400"
                                            onClick={() => deleteCheckpointMutation.mutate(checkpoint.id)}
                                          >
                                            <Trash2 size={14} />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}

                  {managementPhases.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <ListChecks size={36} strokeWidth={1.5} className="mx-auto mb-2" />
                      <p>No management phases yet. Add your first phase to get started.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-5">
                <h3 className="font-semibold mb-2">Client Review Checkpoints</h3>
                <p className="text-xs text-muted-foreground mb-4">Track approval moments and feedback loops.</p>
                <div className="space-y-3">
                  {managementCheckpoints.map((checkpoint) => (
                    <div key={`checkpoint-global-${checkpoint.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{checkpoint.title}</span>
                          <Badge variant={getStatusVariant(checkpoint.status)}>{checkpoint.status.replace("_", " ")}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{checkpoint.description || "No description"}</p>
                      </div>
                      <Select
                        value={checkpoint.status}
                        onValueChange={(value) => updateCheckpointMutation.mutate({ id: checkpoint.id, payload: { status: value } })}
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHECKPOINT_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}

                  {managementCheckpoints.length === 0 && (
                    <p className="text-sm text-muted-foreground">No checkpoints yet.</p>
                  )}
                </div>

                <div className="mt-4 rounded-lg border border-dashed border-border/70 p-3 space-y-2">
                  <Input
                    placeholder="Checkpoint title"
                    value={newCheckpointTitle}
                    onChange={(e) => setNewCheckpointTitle(e.target.value)}
                  />
                  <Input
                    placeholder="Checkpoint description"
                    value={newCheckpointDescription}
                    onChange={(e) => setNewCheckpointDescription(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!newCheckpointTitle.trim()) return;
                      createCheckpointMutation.mutate({
                        title: newCheckpointTitle.trim(),
                        description: newCheckpointDescription.trim(),
                        status: "pending",
                        sortOrder: managementCheckpoints.length,
                      });
                    }}
                  >
                    <Plus size={14} />
                    Add Checkpoint
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-semibold mb-2">At a Glance</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total phases</span>
                    <span className="font-medium">{managementPhases.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tasks</span>
                    <span className="font-medium">{managementTasks.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Agent tasks</span>
                    <span className="font-medium">{managementTasks.filter((t) => t.ownerType === "agent").length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Human tasks</span>
                    <span className="font-medium">{managementTasks.filter((t) => t.ownerType === "human").length}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-5 lg:col-span-2">
              <h3 className="font-semibold mb-3">Project Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Objective</span>
                  <p className="text-sm mt-1">{project.objective}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Constraints</span>
                  <p className="text-sm mt-1">{project.constraints}</p>
                </div>
                <div className="flex items-center gap-4 pt-2 border-t">
                  <div>
                    <span className="text-xs text-muted-foreground">Created</span>
                    <p className="text-sm font-medium">{new Date(project.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Stage</span>
                    <p className="text-sm font-medium">{STAGE_LABELS[project.stage] || project.stage}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3">Workflow Progress</h3>
              <div className="space-y-3">
                {steps.map((step, idx) => {
                  const status = getStepStatusInfo(step);
                  const agentColor = AGENT_COLORS[step.agentKey] || "#6B7280";
                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn("w-6 h-6 rounded-full flex items-center justify-center", status.color)}
                          style={step.status === "not_started" ? {} : { backgroundColor: agentColor + "20" }}
                        >
                          {status.icon}
                        </div>
                        {idx < steps.length - 1 && <div className="w-0.5 h-4 bg-border" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{step.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{status.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workflow" className="mt-4">
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const status = getStepStatusInfo(step);
              const agentColor = AGENT_COLORS[step.agentKey] || "#6B7280";
              const showRun = canRunStep(step, idx);
              const showApprove = canApproveStep(step);

              return (
                <Card key={step.id} className="p-3 sm:p-4" data-testid={`workflow-step-${step.id}`}>
                  <div className="flex items-start sm:items-center gap-3">
                    <div
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: agentColor + "20" }}
                    >
                      <Bot size={18} className="sm:hidden" style={{ color: agentColor }} />
                      <Bot size={20} className="hidden sm:block" style={{ color: agentColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <span className="font-semibold text-sm">{step.name}</span>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: agentColor + "20", color: agentColor }}
                        >
                          Step {step.stepOrder}
                        </span>
                        <span className={cn("text-xs", status.color)}>{status.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.agentKey}</p>
                      <div className="flex items-center gap-2 mt-2 sm:hidden">
                        {showRun && (
                          <Button
                            size="sm"
                            onClick={() => runStep(step.id)}
                            data-testid={`run-step-${step.id}`}
                          >
                            <PlayCircle size={14} />
                            Run
                          </Button>
                        )}
                        {step.status === "running" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/project/${projectId}/workflow/${step.id}`)}
                          >
                            <Loader2 size={14} className="animate-spin" />
                            View Progress
                          </Button>
                        )}
                        {showApprove && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveStepMutation.mutate(step.id)}
                            disabled={approveStepMutation.isPending}
                            data-testid={`approve-step-${step.id}`}
                          >
                            {approveStepMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check size={14} />
                                Approve
                              </>
                            )}
                          </Button>
                        )}
                        {(step.status === "completed" || step.status === "approved") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/project/${projectId}/workflow/${step.id}`)}
                            data-testid={`view-step-${step.id}`}
                          >
                            View
                            <ChevronRight size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {showRun && (
                        <Button
                          size="sm"
                          onClick={() => runStep(step.id)}
                          data-testid={`run-step-${step.id}`}
                        >
                          <PlayCircle size={14} />
                          Run
                        </Button>
                      )}
                      {step.status === "running" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/project/${projectId}/workflow/${step.id}`)}
                        >
                          <Loader2 size={14} className="animate-spin" />
                          View Progress
                        </Button>
                      )}
                      {showApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveStepMutation.mutate(step.id)}
                          disabled={approveStepMutation.isPending}
                          data-testid={`approve-step-${step.id}`}
                        >
                          {approveStepMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check size={14} />
                              Approve
                            </>
                          )}
                        </Button>
                      )}
                      {(step.status === "completed" || step.status === "approved") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/project/${projectId}/workflow/${step.id}`)}
                          data-testid={`view-step-${step.id}`}
                        >
                          View
                          <ChevronRight size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
            {steps.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <GitBranch size={40} strokeWidth={1.5} className="mx-auto mb-2" />
                <p>No workflow steps found. Create a project with a workflow template.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deliverables" className="mt-4">
          {!deliverables || deliverables.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={40} strokeWidth={1.5} className="mx-auto mb-2" />
              <p>No deliverables yet. Run workflow steps to generate deliverables.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deliverables.map((d) => (
                <Card key={d.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-primary" />
                    <h3 className="font-semibold text-sm flex-1">{d.title}</h3>
                    {d.locked && (
                      <Badge variant="default" className="gap-1">
                        <Lock size={10} />
                        Locked
                      </Badge>
                    )}
                    <Badge variant="default">v{d.version}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vault" className="mt-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".txt,.md,.pdf,.doc,.docx,.csv,.json,.html,.xml,.rtf,.pptx,.xlsx"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-testid="vault-upload-btn"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>

            {uploadMutation.isError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                Upload failed: {(uploadMutation.error as Error).message}
              </div>
            )}

            {filteredVaultFiles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Archive size={40} strokeWidth={1.5} className="mx-auto mb-2" />
                <p>{vaultSearch ? "No files match your search" : "No files uploaded yet. Upload documents to enable AI-powered context retrieval."}</p>
                <p className="text-xs mt-1">Supported: PDF, TXT, MD, DOC, DOCX, CSV, JSON, HTML, XML, PPTX, XLSX</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVaultFiles.map((file) => (
                  <Card key={file.id} className="p-3" data-testid={`vault-file-${file.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {getFileIcon(file.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium truncate">{file.fileName}</span>
                          {getStatusBadge(file.embeddingStatus)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{formatFileSize(file.fileSize)}</span>
                          {file.chunkCount > 0 && <span>{file.chunkCount} chunks</span>}
                          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = `/api/projects/${projectId}/vault/${file.id}/download`;
                            a.download = file.fileName;
                            a.click();
                          }}
                          title="Download"
                        >
                          <Download size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-400"
                          onClick={() => {
                            if (confirm(`Delete "${file.fileName}"?`)) {
                              deleteMutation.mutate(file.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {(vaultFiles || []).length > 0 && (
              <Card className="p-3 bg-muted/30 border-dashed">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">RAG-enabled context</p>
                    <p>Files with "Ready" status are automatically used by AI agents when running workflow steps. The agents will retrieve relevant sections from your uploaded documents to ground their analysis in your data.</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {!logs || logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Terminal size={40} strokeWidth={1.5} className="mx-auto mb-2" />
              <p>No activity logs yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Card key={log.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      log.status === "success" ? "bg-foreground" : log.status === "failed" ? "bg-destructive" : "bg-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{log.stage}</span>
                      <span className="text-xs text-muted-foreground ml-2">{log.modelUsed}</span>
                    </div>
                    <Badge variant={log.status === "success" ? "success" : log.status === "failed" ? "destructive" : "warning"}>
                      {log.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {log.errorText && (
                    <p className="text-xs text-red-500 mt-2 ml-5">{log.errorText}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
