import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";

const AGENT_COLORS: Record<string, string> = {
  issues_tree: "#3B82F6",
  mece_critic: "#8B5CF6",
  hypothesis: "#0891B2",
  execution: "#059669",
  summary: "#D97706",
  presentation: "#E11D48",
};

interface StepData {
  step: {
    id: number;
    workflowInstanceId: number;
    stepOrder: number;
    name: string;
    agentKey: string;
    status: string;
    outputSummary: any;
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

export default function WorkflowStepWorkspace() {
  const { id, stepId } = useParams<{ id: string; stepId: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);
  const stepIdNum = Number(stepId);
  const [showPanel, setShowPanel] = useState(window.innerWidth >= 640);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: project } = useQuery<any>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: stepData, isLoading } = useQuery<StepData>({
    queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum],
    refetchInterval: 3000,
  });

  const { data: agentInfo } = useQuery<any>({
    queryKey: ["/api/agents/detail", stepData?.step?.agentKey],
    enabled: !!stepData?.step?.agentKey,
  });

  const runStepMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflow/steps/${stepIdNum}/run`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflow", "steps", stepIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
    },
  });

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

  if (isLoading || !stepData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { step, deliverables } = stepData;
  const agentColor = AGENT_COLORS[step.agentKey] || "#6B7280";
  const isRunning = step.status === "running" || runStepMutation.isPending;
  const canRun = step.status === "not_started" || step.status === "failed";
  const canApprove = step.status === "completed";

  return (
    <div className="flex flex-col h-full">
      <header className="flex shrink-0 items-center gap-1 sm:gap-2 border-b px-2 sm:px-4 min-h-[48px] flex-wrap py-1 sm:py-0 sm:flex-nowrap sm:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 sm:mr-2 h-4 hidden sm:block" />
        <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}`)} className="shrink-0">
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">{project?.name || "Project"}</span>
          <span className="sm:hidden">Back</span>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4 hidden sm:block" />
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <Bot size={16} style={{ color: agentColor }} className="shrink-0" />
          <span className="font-semibold text-xs sm:text-sm truncate">{step.name}</span>
          <span
            className="text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline-block"
            style={{ backgroundColor: agentColor + "20", color: agentColor }}
          >
            Step {step.stepOrder}
          </span>
          <Badge
            variant={
              step.status === "approved" ? "success" :
              step.status === "completed" ? "success" :
              step.status === "running" ? "default" :
              step.status === "failed" ? "destructive" : "default"
            }
            className="text-[10px] sm:text-xs"
          >
            {step.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {canRun && (
            <Button size="sm" onClick={() => runStepMutation.mutate()} disabled={isRunning}>
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <><PlayCircle size={14} /> <span className="hidden sm:inline">Run</span></>}
            </Button>
          )}
          {canApprove && (
            <Button size="sm" variant="outline" onClick={() => approveStepMutation.mutate()} disabled={approveStepMutation.isPending}>
              {approveStepMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check size={14} /> <span className="hidden sm:inline">Approve</span></>}
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
            {step.status === "not_started" && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Bot size={48} strokeWidth={1.5} style={{ color: agentColor }} />
                <h2 className="text-lg font-semibold text-foreground">Ready to Run</h2>
                <p className="text-sm text-center max-w-md">
                  Click "Run" to execute the {step.name} agent. It will analyze your project data and produce deliverables.
                </p>
                <Button onClick={() => runStepMutation.mutate()} disabled={isRunning} className="mt-2">
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <><PlayCircle size={16} /> Run {step.name}</>}
                </Button>
              </div>
            )}

            {step.status === "running" && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: agentColor }} />
                <h2 className="text-lg font-semibold text-foreground">Agent Running</h2>
                <p className="text-sm">The {step.name} agent is processing your project data...</p>
              </div>
            )}

            {step.status === "failed" && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Bot size={24} className="text-red-500" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Step Failed</h2>
                <p className="text-sm text-muted-foreground">The agent encountered an error. You can retry.</p>
                <Button onClick={() => runStepMutation.mutate()} disabled={isRunning} variant="outline" className="mt-2">
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <><PlayCircle size={16} /> Retry</>}
                </Button>
              </div>
            )}

            {(step.status === "completed" || step.status === "approved") && deliverables.length > 0 && (
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: agentColor + "20" }}
                  >
                    <Bot size={16} style={{ color: agentColor }} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold">{step.name} Agent</span>
                    <p className="text-xs text-muted-foreground">Generated {deliverables.length} deliverable(s)</p>
                  </div>
                </div>

                {deliverables.map((d) => (
                  <Card key={d.id} className="p-5 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={16} className="text-primary" />
                      <h3 className="font-semibold text-sm flex-1">{d.title}</h3>
                      <Badge variant="default">v{d.version}</Badge>
                      {d.locked && (
                        <Badge variant="default" className="gap-1"><Lock size={10} /> Locked</Badge>
                      )}
                    </div>
                    <div className="bg-muted rounded-lg p-3 sm:p-4 text-sm font-mono overflow-auto max-h-[400px] max-w-full">
                      <pre className="whitespace-pre-wrap text-xs break-words">
                        {typeof d.contentJson === "string"
                          ? d.contentJson
                          : JSON.stringify(d.contentJson, null, 2)}
                      </pre>
                    </div>
                  </Card>
                ))}

                {step.status === "completed" && (
                  <div className="flex justify-center mt-4">
                    <Button onClick={() => approveStepMutation.mutate()} disabled={approveStepMutation.isPending}>
                      {approveStepMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Check size={16} /> Approve & Lock Deliverables</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {(step.status === "completed" || step.status === "approved") && deliverables.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <CheckCircle size={48} className="text-green-500" />
                <h2 className="text-lg font-semibold text-foreground">Step Complete</h2>
                <p className="text-sm">This step finished but no deliverables were recorded.</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border p-4">
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
              <Textarea
                className="flex-1 resize-none min-h-[40px]"
                placeholder={`Ask the ${step.name} agent...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                rows={1}
                disabled
              />
              <Button size="icon" disabled>
                <Send size={18} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">Agent chat coming soon</p>
          </div>
        </div>

        {showPanel && (
          <div className="w-[320px] border-l border-border bg-muted/30 overflow-y-auto shrink-0">
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
    </div>
  );
}

