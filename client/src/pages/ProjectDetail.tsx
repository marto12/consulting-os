import { useState, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { cn } from "../lib/utils";

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

const AGENT_COLORS: Record<string, string> = {
  issues_tree: "#3B82F6",
  mece_critic: "#8B5CF6",
  hypothesis: "#0891B2",
  execution: "#059669",
  summary: "#D97706",
  presentation: "#E11D48",
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

  const runStepMutation = useMutation({
    mutationFn: async (stepId: number) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflow/steps/${stepId}/run`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deliverables"] });
    },
  });

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

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const steps = workflowData?.steps || [];
  const instance = workflowData?.instance;

  function getStepStatusInfo(step: WorkflowStep) {
    if (step.status === "completed" || step.status === "approved") {
      return { icon: <CheckCircle size={16} />, color: "text-green-500", label: step.status === "approved" ? "Approved" : "Completed" };
    }
    if (step.status === "running") {
      return { icon: <Loader2 size={16} className="animate-spin" />, color: "text-blue-500", label: "Running" };
    }
    if (step.status === "failed") {
      return { icon: <Circle size={16} />, color: "text-red-500", label: "Failed" };
    }
    return { icon: <Circle size={16} />, color: "text-muted-foreground", label: "Not Started" };
  }

  function canRunStep(step: WorkflowStep, idx: number): boolean {
    if (step.status === "running") return false;
    if (step.status === "approved") return false;
    if (idx === 0) return step.status === "not_started" || step.status === "failed";
    const prevStep = steps[idx - 1];
    return (prevStep.status === "completed" || prevStep.status === "approved") &&
      (step.status === "not_started" || step.status === "failed");
  }

  function canApproveStep(step: WorkflowStep): boolean {
    return step.status === "completed";
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          <ChevronLeft size={16} />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={project.stage === "complete" ? "success" : "default"}>
              {STAGE_LABELS[project.stage] || project.stage}
            </Badge>
            <span className="text-sm text-muted-foreground">{project.objective}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><Layers size={14} className="mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="workflow"><GitBranch size={14} className="mr-1.5" />Workflow</TabsTrigger>
          <TabsTrigger value="deliverables"><FileText size={14} className="mr-1.5" />Deliverables</TabsTrigger>
          <TabsTrigger value="activity"><Activity size={14} className="mr-1.5" />Activity</TabsTrigger>
        </TabsList>

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
                <Card key={step.id} className="p-4" data-testid={`workflow-step-${step.id}`}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: agentColor + "20" }}
                    >
                      <Bot size={20} style={{ color: agentColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
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
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {showRun && (
                        <Button
                          size="sm"
                          onClick={() => runStepMutation.mutate(step.id)}
                          disabled={runStepMutation.isPending}
                          data-testid={`run-step-${step.id}`}
                        >
                          {runStepMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <PlayCircle size={14} />
                              Run
                            </>
                          )}
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
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      log.status === "success" ? "bg-green-500" : log.status === "failed" ? "bg-red-500" : "bg-yellow-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{log.stage}</span>
                      <span className="text-xs text-muted-foreground ml-2">{log.modelUsed}</span>
                    </div>
                    <Badge variant={log.status === "success" ? "success" : log.status === "failed" ? "destructive" : "warning"}>
                      {log.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
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
