import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import {
  Plus,
  ChevronRight,
  Briefcase,
  Loader2,
  BarChart3,
  FileText,
  Database,
  ShieldCheck,
  LineChart,
  Factory,
  Cpu,
  Globe,
  Calculator,
  Users,
  Trash2,
} from "lucide-react";
import { marked } from "marked";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { ScrollArea } from "../components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useUserContext } from "../lib/user-context";

const STAGE_LABELS: Record<string, string> = {
  created: "",
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

const COMPLETED_STATUSES = new Set(["complete", "completed", "approved", "ready"]);

type ManagementData = {
  tasks: {
    id: number;
    title: string;
    status: string;
    ownerType?: string;
    assigneeUserId?: number | null;
    workflowStepId?: number | null;
    updatedAt?: string;
  }[];
  checkpoints: {
    id: number;
    title: string;
    status: string;
    updatedAt?: string;
  }[];
  workflowSteps: { id: number; name: string; agentKey?: string }[];
};

const STAGE_ORDER = [
  "created",
  "definition_draft",
  "definition_approved",
  "issues_draft",
  "issues_approved",
  "hypotheses_draft",
  "hypotheses_approved",
  "execution_done",
  "execution_approved",
  "summary_draft",
  "summary_approved",
  "presentation_draft",
  "complete",
];

function getStageVariant(stage: string): "success" | "warning" | "default" {
  if (stage === "complete") return "success";
  if (stage.includes("approved")) return "success";
  if (stage.includes("draft") || stage === "execution_done") return "warning";
  return "default";
}

function getStageProgress(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1) return 0;
  return (idx / (STAGE_ORDER.length - 1)) * 100;
}

function getStageSteps(stage: string) {
  const idx = STAGE_ORDER.indexOf(stage);
  const currentLabel = STAGE_LABELS[stage] || stage;
  if (idx === -1) return { currentLabel, nextLabels: [] as string[] };

  const nextLabels = STAGE_ORDER.slice(idx + 1, idx + 3).map(
    (next) => STAGE_LABELS[next] || next
  );
  return { currentLabel, nextLabels };
}

function getProjectIcon(name: string, description?: string) {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  if (text.match(/market|growth|go[- ]to[- ]market|gtm|segmentation|pricing|revenue/)) return LineChart;
  if (text.match(/data|dataset|analytics|insight|survey|research|benchmark/)) return BarChart3;
  if (text.match(/model|forecast|financial|l?tv|roi|margin|budget|cost/)) return Calculator;
  if (text.match(/risk|compliance|regulation|governance|audit|policy/)) return ShieldCheck;
  if (text.match(/ops|operations|supply|logistics|manufactur|plant/)) return Factory;
  if (text.match(/tech|platform|system|architecture|infrastructure|ai|ml/)) return Cpu;
  if (text.match(/product|roadmap|feature|experience|design/)) return FileText;
  if (text.match(/customer|client|stakeholder|team|org/)) return Users;
  if (text.match(/global|region|country|expansion|entry/)) return Globe;
  if (text.match(/data warehouse|etl|pipeline|database/)) return Database;
  return Briefcase;
}

function getManagementActivity(
  data: ManagementData | undefined,
  userLookup: Map<number, string>,
  agentLookup: Map<string, string>
) {
  if (!data) return [] as { label: string; assignee: string }[];
  const stepMap = new Map<number, { id: number; name: string; agentKey?: string }>();
  data.workflowSteps?.forEach((step) => stepMap.set(step.id, step));
  const completedTasks = (data.tasks || [])
    .filter((task) => COMPLETED_STATUSES.has(task.status))
    .map((task) => ({
      type: "task" as const,
      id: task.id,
      title: task.title,
      status: task.status,
      ownerType: task.ownerType,
      assigneeUserId: task.assigneeUserId,
      workflowStepId: task.workflowStepId,
      updatedAt: task.updatedAt,
    }));

  const completedCheckpoints = (data.checkpoints || [])
    .filter((checkpoint) => COMPLETED_STATUSES.has(checkpoint.status))
    .map((checkpoint) => ({
      type: "checkpoint" as const,
      id: checkpoint.id,
      title: checkpoint.title,
      status: checkpoint.status,
      updatedAt: checkpoint.updatedAt,
    }));

  const combined = [...completedTasks, ...completedCheckpoints]
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  return combined.map((item) => {
    if (item.type === "checkpoint") {
      return { label: `${item.title} (Client review)`, assignee: "Client" };
    }
    const task = item;
    let assignee = "Unassigned";
    if (task.ownerType === "human" && task.assigneeUserId) {
      assignee = userLookup.get(task.assigneeUserId) ?? "Unknown user";
    } else if (task.ownerType === "agent") {
      const step = task.workflowStepId ? stepMap.get(task.workflowStepId) : null;
      if (step?.agentKey) {
        assignee = agentLookup.get(step.agentKey) ?? step.agentKey;
      } else {
        assignee = "Agent";
      }
    }
    return { label: task.title, assignee };
  });
}

function getRecentActivity(project: any): string[] {
  const stageLabel = STAGE_LABELS[project.stage] || project.stage;
  const activity: string[] = [];

  if (project.stage === "complete") {
    activity.push("Project delivery finalized");
  }

  if (project.stage && project.stage.includes("approved")) {
    activity.push("Latest review approved");
  }

  if (project.stage && project.stage.includes("draft")) {
    activity.push("Draft ready for review");
  }

  if (project.stage === "execution_done") {
    activity.push("Execution output ready");
  }

  if (project.objective) {
    activity.push("Objective captured");
  }

  if (project.constraints) {
    activity.push("Constraints captured");
  }

  activity.push(`Stage updated to ${stageLabel}`);

  return Array.from(new Set(activity)).slice(0, 3);
}

const getInitials = (name?: string) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
};

interface ProjectTemplate {
  slug: string;
  name: string;
  content: string;
}

export default function Projects() {
  const navigate = useNavigate();
  const { users } = useUserContext();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [templatePreview, setTemplatePreview] = useState<ProjectTemplate | null>(null);
  const [copiedTemplateSlug, setCopiedTemplateSlug] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 5000,
  });

  const managementQueries = useQueries({
    queries: (projects || []).map((project) => ({
      queryKey: ["/api/projects", project.id, "management"],
      queryFn: async () => {
        const res = await fetch(`/api/projects/${project.id}/management`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      enabled: !!projects?.length,
    })),
  });

  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  const {
    data: projectTemplates = [],
    isLoading: templatesLoading,
    error: templatesError,
  } = useQuery<ProjectTemplate[]>({
    queryKey: ["/api/project-templates"],
  });

  const userLookup = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((user) => map.set(user.id, user.name));
    return map;
  }, [users]);

  const agentLookup = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((agent: any) => map.set(agent.key, agent.name));
    return map;
  }, [agents]);

  const managementByProjectId = useMemo(() => {
    const map = new Map<number, ManagementData>();
    if (!projects) return map;
    managementQueries.forEach((query, idx) => {
      const project = projects[idx];
      if (project && query.data) {
        map.set(project.id, query.data as ManagementData);
      }
    });
    return map;
  }, [managementQueries, projects]);

  const templatePreviewHtml = useMemo(() => {
    if (!templatePreview) return "";
    return marked.parse(templatePreview.content, { async: false }) as string;
  }, [templatePreview]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/projects", {
        name,
        objective,
        projectTemplateSlug: selectedTemplate?.slug,
      });
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowCreate(false);
      setName("");
      setObjective("");
      setSelectedTemplate(null);
      if (created?.id) {
        navigate(`/project/${created.id}`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const skeletonCards = Array.from({ length: 6 });
  const projectSummary = projects && projects.length > 0
    ? projects.reduce(
      (acc, project) => {
        const progress = getStageProgress(project.stage);
        const isComplete = project.stage === "complete";
        const isPending = project.stage.includes("draft") || project.stage === "execution_done";

        acc.total += 1;
        acc.complete += isComplete ? 1 : 0;
        acc.needsReview += isPending ? 1 : 0;
        acc.progressTotal += progress;
        return acc;
      },
      { total: 0, complete: 0, needsReview: 0, progressTotal: 0 }
    )
    : null;

  const averageProgress = projectSummary
    ? Math.round(projectSummary.progressTotal / projectSummary.total)
    : 0;

  const copyTemplate = async (template: ProjectTemplate) => {
    try {
      await navigator.clipboard.writeText(template.content);
      setCopiedTemplateSlug(template.slug);
      window.setTimeout(() => {
        setCopiedTemplateSlug((current) => (current === template.slug ? null : current));
      }, 1500);
    } catch {
      setCopiedTemplateSlug(null);
    }
  };

  const applyTemplateToNewProject = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setObjective("");
    setShowCreate(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-Powered Strategy Workflow</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="create-project-btn">
          <Plus size={18} />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {skeletonCards.map((_, idx) => (
            <Card key={`project-skeleton-${idx}`} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
                <Skeleton className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-10 gap-3 text-muted-foreground">
          <Briefcase size={48} strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
          <p>Create your first project to start the AI consulting workflow</p>
        </div>
      ) : (
        <div>
          {projectSummary && (
            <Card className="mb-4 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-foreground">Overview</span>
                <span className="text-muted-foreground">• {projectSummary.total} total</span>
                <span className="text-muted-foreground">• {projectSummary.total - projectSummary.complete} active</span>
                <span className="text-muted-foreground">• {projectSummary.needsReview} need review</span>
                <span className="text-muted-foreground">• {projectSummary.complete} complete</span>
                <span className="text-muted-foreground">• Avg progress {averageProgress}%</span>
              </div>
            </Card>
          )}
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3 font-medium">Current step</th>
                    <th className="px-4 py-3 font-medium">Next steps</th>
                    <th className="px-4 py-3 font-medium">Recent activity</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((item: any) => {
                    const variant = getStageVariant(item.stage);
                    const progress = getStageProgress(item.stage);
                    const isPending = item.stage.includes("draft") || item.stage === "execution_done";
                    const managementActivity = getManagementActivity(
                      managementByProjectId.get(item.id),
                      userLookup,
                      agentLookup
                    );
                    const activityItems = managementActivity.length > 0
                      ? managementActivity
                      : getRecentActivity(item).map((label) => ({ label, assignee: "" }));
                    const ProjectIcon = getProjectIcon(item.name, item.objective);
                    return (
                      <tr
                        key={item.id}
                        className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigate(`/project/${item.id}`)}
                        data-testid={`project-row-${item.id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[220px]">
                            <div className="h-8 w-8 rounded-lg bg-muted/70 flex items-center justify-center">
                              <ProjectIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">{item.name}</div>
                              <div className="text-[11px] text-muted-foreground line-clamp-1">{item.objective}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.stage !== "created" && (
                              <Badge variant={variant}>
                                {STAGE_LABELS[item.stage] || item.stage}
                              </Badge>
                            )}
                            {isPending && (
                              <Badge variant="warning">Needs Review</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <Progress value={progress} className="flex-1 h-1.5" />
                            <span className="text-[11px] text-muted-foreground w-8 text-right">{Math.round(progress)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {getStageSteps(item.stage).currentLabel}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {getStageSteps(item.stage).nextLabels.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {getStageSteps(item.stage).nextLabels.map((label) => (
                                <div key={`${item.id}-${label}`} className="flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                                  <span className="text-[11px]">{label}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px]">No upcoming steps</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {activityItems.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {activityItems.map((activity, idx) => (
                                <div key={`${item.id}-activity-${idx}`} className="flex items-start gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                                  <span className="text-[11px] leading-relaxed">
                                    {activity.label}
                                    {activity.assignee && (
                                      <span className="text-muted-foreground/70"> — {activity.assignee}</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px]">No recent activity yet.</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (confirm("Delete this project? This cannot be undone.")) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              aria-label="Delete project"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {projectTemplates.length > 0 && (
        <Card className="mt-10 p-3 border border-border/60 bg-background/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Project templates</h2>
              <p className="text-xs text-muted-foreground">Copy a delivery plan into your project workspace.</p>
            </div>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Templates</span>
          </div>
          <div className="mt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Template</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTemplates.map((template) => (
                    <tr key={template.slug} className="border-t border-border/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{template.name}</span>
                          <Badge variant="outline" className="text-[10px]">Template</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        Delivery phases, tasks, and owners.
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setTemplatePreview(template)}>
                            Preview
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => copyTemplate(template)}>
                            {copiedTemplateSlug === template.slug ? "Copied" : "Copy"}
                          </Button>
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => applyTemplateToNewProject(template)}>
                            Use
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new AI consulting project</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={selectedTemplate?.slug ?? "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setSelectedTemplate(null);
                    return;
                  }
                  const template = projectTemplates.find((item) => item.slug === value);
                  if (template) applyTemplateToNewProject(template);
                }}
                disabled={templatesLoading || projectTemplates.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={templatesLoading ? "Loading templates" : "Select a template"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {projectTemplates.map((template) => (
                    <SelectItem key={template.slug} value={template.slug}>
                      {template.name}
                    </SelectItem>
                  ))}
                  {projectTemplates.length === 0 && !templatesLoading && (
                    <SelectItem value="empty" disabled>
                      No templates available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {templatesError && (
                <p className="text-xs text-destructive">Templates failed to load. Restart the server to pick up new templates.</p>
              )}
              {!templatesError && !templatesLoading && projectTemplates.length === 0 && (
                <p className="text-xs text-muted-foreground">No templates found in templates/projects.</p>
              )}
            </div>
            {selectedTemplate && (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span>Using template: <span className="font-semibold text-foreground">{selectedTemplate.name}</span></span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 text-xs"
                  onClick={() => {
                    setSelectedTemplate(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                placeholder="e.g., Market Entry Strategy"
                value={name}
                onChange={e => setName(e.target.value)}
                data-testid="project-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Objective (optional)</Label>
              <Textarea
                placeholder="What should this project achieve?"
                value={objective}
                onChange={e => setObjective(e.target.value)}
                rows={3}
                data-testid="project-objective-input"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!name || createMutation.isPending}
              data-testid="submit-project-btn"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!templatePreview} onOpenChange={(open) => !open && setTemplatePreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{templatePreview?.name}</DialogTitle>
            <DialogDescription>Review the template and copy it into your workflow.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => templatePreview && copyTemplate(templatePreview)}
            >
              {templatePreview && copiedTemplateSlug === templatePreview.slug ? "Copied" : "Copy template"}
            </Button>
          </div>
          <ScrollArea className="h-[420px] rounded-md border border-border">
            <div
              className="prose prose-sm dark:prose-invert max-w-none p-4"
              dangerouslySetInnerHTML={{ __html: templatePreviewHtml }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
