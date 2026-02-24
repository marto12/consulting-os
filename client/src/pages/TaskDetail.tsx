import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Link as LinkIcon } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useUserContext } from "../lib/user-context";
import { apiRequest } from "../lib/query-client";

type ProjectTask = {
  id: number;
  title: string;
  description: string;
  taskType: "human" | "agent" | "client";
  ownerType: string;
  status: string;
  assigneeUserId?: number | null;
  workflowStepId: number | null;
};

type WorkflowStep = {
  id: number;
  name: string;
  status?: string;
  workflowName?: string | null;
};

type ManagementData = {
  tasks: ProjectTask[];
  workflowSteps: WorkflowStep[];
};

type Deliverable = {
  id: number;
  stepId: number;
  title: string;
  version: number;
  createdAt: string;
};

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
  const { users } = useUserContext();
  const queryClient = useQueryClient();
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [workflowStepDraft, setWorkflowStepDraft] = useState("");

  const { data: managementData } = useQuery<ManagementData>({
    queryKey: ["/api/projects", projectId, "management"],
    enabled: Number.isFinite(projectId),
  });

  const { data: deliverables = [] } = useQuery<Deliverable[]>({
    queryKey: ["/api/projects", projectId, "deliverables"],
    enabled: Number.isFinite(projectId),
  });

  const task = useMemo(() => {
    return managementData?.tasks.find((t) => t.id === taskIdNumber) || null;
  }, [managementData?.tasks, taskIdNumber]);

  const workflowStep = useMemo(() => {
    if (!task?.workflowStepId) return null;
    return managementData?.workflowSteps.find((step) => step.id === task.workflowStepId) || null;
  }, [managementData?.workflowSteps, task?.workflowStepId]);

  const workflowStepLabel = useMemo(() => {
    if (!workflowStep) return "None";
    return workflowStep.workflowName ? `${workflowStep.workflowName} · ${workflowStep.name}` : workflowStep.name;
  }, [workflowStep]);

  const workflowStatusLabel = useMemo(() => {
    if (!workflowStep?.status) return null;
    return workflowStep.status.replace(/_/g, " ");
  }, [workflowStep?.status]);

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to network
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{task.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{task.description || "No description"}</p>
        </div>
        <Badge variant="secondary">{task.status.replace(/_/g, " ")}</Badge>
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
        </div>
      </Card>

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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
