import { useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
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

  const [vaultSearch, setVaultSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      return { icon: <CheckCircle size={16} />, color: "text-foreground", label: step.status === "approved" ? "Approved" : "Completed" };
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
    if (idx === 0) return step.status === "not_started" || step.status === "failed";
    const prevStep = steps[idx - 1];
    return (prevStep.status === "completed" || prevStep.status === "approved") &&
      (step.status === "not_started" || step.status === "failed");
  }

  function canApproveStep(step: WorkflowStep): boolean {
    return step.status === "completed";
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

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="overview"><Layers size={14} className="mr-1.5" />Overview</TabsTrigger>
            <TabsTrigger value="workflow"><GitBranch size={14} className="mr-1.5" />Workflow</TabsTrigger>
            <TabsTrigger value="deliverables"><FileText size={14} className="mr-1.5" />Deliverables</TabsTrigger>
            <TabsTrigger value="vault"><Archive size={14} className="mr-1.5" />Vault</TabsTrigger>
            <TabsTrigger value="activity"><Activity size={14} className="mr-1.5" />Activity</TabsTrigger>
          </TabsList>
        </div>

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
