import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Plus, ChevronRight, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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

function getStageVariant(stage: string): "success" | "warning" | "default" {
  if (stage === "complete") return "success";
  if (stage.includes("approved")) return "success";
  if (stage.includes("draft") || stage === "execution_done") return "warning";
  return "default";
}

function getStageProgress(stage: string): number {
  const stages = [
    "created", "issues_draft", "issues_approved", "hypotheses_draft",
    "hypotheses_approved", "execution_done", "execution_approved",
    "summary_draft", "complete",
  ];
  const idx = stages.indexOf(stage);
  if (idx === -1) return 0;
  return (idx / (stages.length - 1)) * 100;
}

export default function Projects() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [constraints, setConstraints] = useState("");

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/projects", { name, objective, constraints });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowCreate(false);
      setName("");
      setObjective("");
      setConstraints("");
    },
  });

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
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-10 gap-3 text-muted-foreground">
          <Briefcase size={48} strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
          <p>Create your first project to start the AI consulting workflow</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((item: any) => {
            const variant = getStageVariant(item.stage);
            const progress = getStageProgress(item.stage);
            const isPending = item.stage.includes("draft") || item.stage === "execution_done";
            return (
              <Card
                key={item.id}
                className="cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all p-4"
                onClick={() => navigate(`/project/${item.id}`)}
                data-testid={`project-card-${item.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.objective}</p>
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground shrink-0 mt-1" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={variant}>
                      {STAGE_LABELS[item.stage] || item.stage}
                    </Badge>
                    {isPending && (
                      <Badge variant="warning">Needs Review</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="flex-1 h-1.5" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(progress)}%</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new AI consulting project</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
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
              <Label>Objective</Label>
              <Textarea
                placeholder="What should this project achieve?"
                value={objective}
                onChange={e => setObjective(e.target.value)}
                rows={3}
                data-testid="project-objective-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Constraints</Label>
              <Textarea
                placeholder="Budget limits, timeline, resources..."
                value={constraints}
                onChange={e => setConstraints(e.target.value)}
                rows={3}
                data-testid="project-constraints-input"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!name || !objective || !constraints || createMutation.isPending}
              data-testid="submit-project-btn"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
