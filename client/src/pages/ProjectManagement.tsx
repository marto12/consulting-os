import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import { useUserContext } from "../lib/user-context";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
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
  CheckCircle2,
  Circle,
  CircleDot,
  FileText,
  Lock,
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
  description: string;
  ownerType: string;
  assigneeUserId?: number | null;
  assigneeIds?: number[];
  workflowStepId: number | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type WorkflowStep = {
  id: number;
  name: string;
  status: string;
  agentKey?: string;
};

type ManagementData = {
  phases: ProjectPhase[];
  tasks: ProjectTask[];
  workflowSteps: WorkflowStep[];
};

function getStatusStyles(status: string) {
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
    case "needs_review":
      return {
        card: "border-amber-200 bg-amber-50",
        chip: "border-amber-200 text-amber-700",
      };
    case "blocked":
      return {
        card: "border-rose-200 bg-rose-50",
        chip: "border-rose-200 text-rose-700",
      };
    default:
      return {
        card: "border-border bg-white",
        chip: "border-border text-muted-foreground",
      };
  }
}

function getStatusMeta(status: string) {
  switch (status) {
    case "complete":
      return { label: "Complete", Icon: CheckCircle2 };
    case "in_progress":
      return { label: "In progress", Icon: CircleDot };
    case "needs_review":
      return { label: "Needs review", Icon: AlertTriangle };
    case "blocked":
      return { label: "Blocked", Icon: AlertTriangle };
    default:
      return { label: "Not started", Icon: Circle };
  }
}

const TASK_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "needs_review", label: "Needs Review" },
  { value: "complete", label: "Complete" },
];

export default function ProjectManagement() {
  const { id } = useParams<{ id: string }>();
  const projectId = id ? Number(id) : NaN;
  const queryClient = useQueryClient();
  const { users } = useUserContext();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "board" | "timeline">("list");
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const { data: managementData, isLoading } = useQuery<ManagementData>({
    queryKey: ["/api/projects", projectId, "management"],
    enabled: Number.isFinite(projectId),
  });

  const { data: deliverables = [] } = useQuery<
    { id: number; stepId: number; title: string; version: number; createdAt: string }[]
  >({
    queryKey: ["/api/projects", projectId, "deliverables"],
    enabled: Number.isFinite(projectId),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: number; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "management"] });
    },
  });

  const phases = useMemo(() => {
    return [...(managementData?.phases || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [managementData?.phases]);

  const tasksByPhase = useMemo(() => {
    const map = new Map<number | null, ProjectTask[]>();
    (managementData?.tasks || []).forEach((task) => {
      const key = task.phaseId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    });
    map.forEach((tasks) => tasks.sort((a, b) => a.sortOrder - b.sortOrder));
    return map;
  }, [managementData?.tasks]);

  const taskById = useMemo(() => {
    const map = new Map<number, ProjectTask>();
    (managementData?.tasks || []).forEach((task) => map.set(task.id, task));
    return map;
  }, [managementData?.tasks]);

  const selectedTask = selectedTaskId ? taskById.get(selectedTaskId) ?? null : null;
  const selectedDeliverables = useMemo(() => {
    if (!selectedTask?.workflowStepId) return [];
    return deliverables.filter((d) => d.stepId === selectedTask.workflowStepId);
  }, [deliverables, selectedTask?.workflowStepId]);

  const selectedLocked = selectedTask?.status === "complete";

  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    if (!selectedTask) {
      setNotes("");
      setNotesDirty(false);
      return;
    }
    setNotes(selectedTask.description || "");
    setNotesDirty(false);
  }, [selectedTask?.id]);

  const saveNotes = useCallback(() => {
    if (!selectedTask || !notesDirty) return;
    updateTaskMutation.mutate({
      taskId: selectedTask.id,
      payload: { description: notes },
    });
    setNotesDirty(false);
  }, [notes, notesDirty, selectedTask, updateTaskMutation]);

  const allTasks = useMemo(() => {
    return [...(managementData?.tasks || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [managementData?.tasks]);

  const assigneeOptions = useMemo(() => {
    const humanOptions = users.map((user) => ({ value: `human:${user.id}`, label: user.name, group: "Humans" }));
    const workflowOptions = (managementData?.workflowSteps || []).map((step) => ({
      value: `workflow:${step.id}`,
      label: step.name,
      group: "Agentic workflows",
    }));
    return [...humanOptions, ...workflowOptions];
  }, [managementData?.workflowSteps, users]);

  const groupedAssigneeOptions = useMemo(() => {
    const groups = new Map<string, { value: string; label: string }[]>();
    assigneeOptions.forEach((option) => {
      if (!groups.has(option.group)) groups.set(option.group, []);
      groups.get(option.group)?.push({ value: option.value, label: option.label });
    });
    return Array.from(groups.entries());
  }, [assigneeOptions]);

  const getAssigneeValue = useCallback((task: ProjectTask) => {
    if (task.ownerType === "human") {
      return task.assigneeUserId ? `human:${task.assigneeUserId}` : "unassigned";
    }
    if (task.ownerType === "agent") {
      return task.workflowStepId ? `workflow:${task.workflowStepId}` : "unassigned";
    }
    return "unassigned";
  }, []);

  const getAssigneeLabel = useCallback(
    (value: string) => {
      if (value === "unassigned") return "Unassigned";
      const found = assigneeOptions.find((option) => option.value === value);
      return found?.label ?? "Unassigned";
    },
    [assigneeOptions]
  );

  const getOwnerLabel = useCallback((task: ProjectTask) => {
    return task.ownerType === "agent" ? "Agent" : "Human";
  }, []);

  const handleAssigneeChange = useCallback(
    (taskId: number, value: string) => {
      if (value === "unassigned") {
        updateTaskMutation.mutate({
          taskId,
          payload: { assigneeUserId: null, workflowStepId: null },
        });
        return;
      }
      if (value.startsWith("human:")) {
        updateTaskMutation.mutate({
          taskId,
          payload: { ownerType: "human", assigneeUserId: Number(value.split(":")[1]), workflowStepId: null },
        });
        return;
      }
      if (value.startsWith("workflow:")) {
        updateTaskMutation.mutate({
          taskId,
          payload: { ownerType: "agent", workflowStepId: Number(value.split(":")[1]), assigneeUserId: null },
        });
      }
    },
    [updateTaskMutation]
  );

  const handleStatusChange = useCallback(
    (taskId: number, status: string) => {
      updateTaskMutation.mutate({ taskId, payload: { status } });
    },
    [updateTaskMutation]
  );

  const handleStatusDrop = useCallback(
    (taskId: number, status: string) => {
      updateTaskMutation.mutate({ taskId, payload: { status } });
    },
    [updateTaskMutation]
  );


  const tasksByStatus = useMemo(() => {
    const map = new Map<string, ProjectTask[]>();
    TASK_STATUS_OPTIONS.forEach((option) => map.set(option.value, []));
    allTasks.forEach((task) => {
      if (!map.has(task.status)) map.set(task.status, []);
      map.get(task.status)?.push(task);
    });
    return map;
  }, [allTasks]);

  const phaseLookup = useMemo(() => {
    const map = new Map<number, string>();
    phases.forEach((phase) => map.set(phase.id, phase.title));
    return map;
  }, [phases]);

  const unassignedTasks = tasksByPhase.get(null) || [];

  const ganttWeeks = 10;
  const ganttWeekWidth = 72;

  const getDummyDuration = useCallback((task: ProjectTask) => {
    return 1 + (task.id % 3);
  }, []);

  const buildGanttSchedule = useCallback((tasks: ProjectTask[]) => {
    const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    let cursor = 0;
    return sorted.map((task) => {
      const duration = getDummyDuration(task);
      const start = cursor;
      cursor += duration;
      return {
        task,
        start,
        duration,
        end: cursor,
      };
    });
  }, [getDummyDuration]);

  const ganttByPhase = useMemo(() => {
    const entries = phases.map((phase) => ({
      phase,
      schedule: buildGanttSchedule(tasksByPhase.get(phase.id) || []),
    }));
    if (unassignedTasks.length > 0) {
      entries.push({
        phase: { id: -1, title: "Unassigned" } as ProjectPhase,
        schedule: buildGanttSchedule(unassignedTasks),
      });
    }
    return entries;
  }, [phases, tasksByPhase, buildGanttSchedule, unassignedTasks]);

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Project Management</h2>
          <p className="text-sm text-muted-foreground">Track tasks across list, board, and timeline views.</p>
        </div>
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
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Loading tasks...
        </div>
      ) : allTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Add tasks to get started.
        </div>
      ) : view === "list" ? (
        <div className="rounded-xl border border-border bg-background overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[minmax(220px,2fr)_140px_200px_120px_160px_60px] gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
              <div>Task</div>
              <div>Status</div>
              <div>Assignee</div>
              <div>Owner</div>
              <div>Phase</div>
              <div></div>
            </div>
            {allTasks.map((task) => {
              const statusMeta = getStatusMeta(task.status);
              const statusStyles = getStatusStyles(task.status);
              return (
                <div
                  key={task.id}
                  className="grid grid-cols-[minmax(220px,2fr)_140px_200px_120px_160px_60px] gap-3 px-4 py-3 text-sm border-b border-border hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{task.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{task.description || "No description"}</div>
                  </div>
                  <div>
                    <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${statusStyles.chip}`}>
                      <statusMeta.Icon className="h-3 w-3" />
                      {statusMeta.label}
                    </div>
                  </div>
                  <div>
                    <select
                      value={getAssigneeValue(task)}
                      onChange={(event) => handleAssigneeChange(task.id, event.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="unassigned">Unassigned</option>
                      {groupedAssigneeOptions.map(([group, options]) => (
                        <optgroup key={group} label={group}>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-muted-foreground">{getOwnerLabel(task)}</div>
                  <div className="text-xs text-muted-foreground">
                    {task.phaseId ? phaseLookup.get(task.phaseId) : "Unassigned"}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedTaskId(task.id);
                      }}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === "board" ? (
        <div className="grid gap-4 lg:grid-cols-5">
          {TASK_STATUS_OPTIONS.map((column) => {
            const columnTasks = tasksByStatus.get(column.value) || [];
            return (
              <div
                key={column.value}
                className={cn(
                  "rounded-xl border border-border bg-muted/30 p-3 transition-colors",
                  dragOverStatus === column.value && "border-primary/60 bg-primary/5"
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverStatus(column.value);
                }}
                onDragLeave={() => setDragOverStatus((current) => (current === column.value ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  const raw = event.dataTransfer.getData("text/plain");
                  const taskId = Number(raw);
                  if (Number.isFinite(taskId)) {
                    handleStatusDrop(taskId, column.value);
                  }
                  setDragOverStatus(null);
                }}
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>{column.label}</span>
                  <span>{columnTasks.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                      No tasks
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const statusStyles = getStatusStyles(task.status);
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", String(task.id));
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          className={cn(
                            "rounded-lg border px-3 py-2 bg-background cursor-pointer hover:shadow-sm transition-shadow",
                            statusStyles.card
                          )}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <div className="text-sm font-semibold text-foreground truncate">{task.title}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground truncate">
                            {getAssigneeLabel(getAssigneeValue(task))}
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-2">
                            <span>{getOwnerLabel(task)}</span>
                            {task.ownerType === "agent" && <Zap className="h-3 w-3 text-primary" />}
                            {task.status === "complete" && <Lock className="h-3 w-3" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[220px_1fr] border-b border-border">
              <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phase</div>
              <div className="px-4 py-3">
                <div className="grid" style={{ gridTemplateColumns: `repeat(${ganttWeeks}, ${ganttWeekWidth}px)` }}>
                  {Array.from({ length: ganttWeeks }, (_, idx) => (
                    <div key={idx} className="text-[10px] text-muted-foreground text-center">
                      W{idx + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {ganttByPhase.map(({ phase, schedule }) => (
              <div key={phase.id} className="grid grid-cols-[220px_1fr] border-b border-border">
                <div className="px-4 py-4">
                  <div className="text-xs font-semibold text-foreground truncate">{phase.title}</div>
                  <div className="text-[10px] text-muted-foreground">{schedule.length} tasks</div>
                </div>
                <div className="relative px-4 py-3">
                  <div
                    className="grid absolute inset-y-0 left-4 right-4"
                    style={{ gridTemplateColumns: `repeat(${ganttWeeks}, ${ganttWeekWidth}px)` }}
                  >
                    {Array.from({ length: ganttWeeks }, (_, idx) => (
                      <div key={idx} className="border-l border-dashed border-border/60" />
                    ))}
                  </div>

                  <div className="relative">
                    {schedule.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No tasks</div>
                    ) : (
                      schedule.map((item, index) => {
                        const statusStyles = getStatusStyles(item.task.status);
                        const left = item.start * ganttWeekWidth;
                        const width = Math.max(item.duration * ganttWeekWidth - 8, 48);
                        const top = index * 32;
                        return (
                          <button
                            key={item.task.id}
                            className={cn(
                              "absolute rounded-md border px-2 py-1 text-left text-[10px] font-semibold hover:shadow-sm",
                              statusStyles.card
                            )}
                            style={{ left, top, width }}
                            onClick={() => setSelectedTaskId(item.task.id)}
                          >
                            <div className="truncate">{item.task.title}</div>
                          </button>
                        );
                      })
                    )}

                    {schedule.length > 1 && (
                      <svg
                        className="absolute left-0 top-0"
                        width={ganttWeeks * ganttWeekWidth}
                        height={schedule.length * 32}
                      >
                        {schedule.map((item, index) => {
                          if (index === schedule.length - 1) return null;
                          const next = schedule[index + 1];
                          const x1 = item.start * ganttWeekWidth + item.duration * ganttWeekWidth - 6;
                          const y1 = index * 32 + 12;
                          const x2 = next.start * ganttWeekWidth + 4;
                          const y2 = (index + 1) * 32 + 12;
                          return (
                            <path
                              key={`${item.task.id}-link`}
                              d={`M ${x1} ${y1} L ${x2} ${y2}`}
                              stroke="#94A3B8"
                              strokeWidth="1.5"
                              fill="none"
                            />
                          );
                        })}
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={Boolean(selectedTaskId)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[480px]">
          {selectedTask ? (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>{selectedTask.title}</SheetTitle>
                <SheetDescription>
                  {selectedTask.description || "No description provided."}
                </SheetDescription>
                {selectedLocked && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    Locked: completed tasks are read-only.
                  </div>
                )}
              </SheetHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                  <select
                    value={selectedTask.status}
                    onChange={(event) => handleStatusChange(selectedTask.id, event.target.value)}
                    disabled={selectedLocked}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {TASK_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignee</div>
                  <select
                    value={getAssigneeValue(selectedTask)}
                    onChange={(event) => handleAssigneeChange(selectedTask.id, event.target.value)}
                    disabled={selectedLocked}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="unassigned">Unassigned</option>
                    {groupedAssigneeOptions.map(([group, options]) => (
                      <optgroup key={group} label={group}>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</div>
                  <div className="text-sm font-semibold text-foreground">
                    {getOwnerLabel(selectedTask)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">Notes</div>
                <Textarea
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setNotesDirty(true);
                  }}
                  onBlur={saveNotes}
                  rows={5}
                  disabled={selectedLocked}
                />
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={saveNotes} disabled={selectedLocked || !notesDirty}>
                    Save notes
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-foreground">Linked outputs</div>
                {selectedDeliverables.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No deliverables yet.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {selectedDeliverables.map((deliverable) => (
                      <Card key={deliverable.id} className="p-3">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{deliverable.title}</div>
                            <div className="text-xs text-muted-foreground">v{deliverable.version}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(deliverable.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">Dependencies</div>
                <div className="text-sm text-muted-foreground">No dependencies configured.</div>
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
