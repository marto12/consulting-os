import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { GitBranch, ChevronRight, Bot, Plus, Pencil, Trash2, Copy } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  version: number;
  steps: { id: number; stepOrder: number; name: string; agentKey: string }[];
}

export default function Workflows() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: workflows, isLoading } = useQuery<WorkflowTemplate[]>({
    queryKey: ["/api/workflows"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (wf: WorkflowTemplate) => {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${wf.name} (Copy)`,
          description: wf.description,
          steps: wf.steps.map((s) => ({
            stepOrder: s.stepOrder,
            name: s.name,
            agentKey: s.agentKey,
            description: "",
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
  });

  if (isLoading) {
    const skeletonCards = Array.from({ length: 4 });
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skeletonCards.map((_, idx) => (
          <Card key={`workflow-skeleton-${idx}`} className="p-5">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-5 w-14" />
            </div>
            <Skeleton className="h-3 w-full mb-4" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflow Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable agent pipelines for projects</p>
        </div>
        <Button onClick={() => navigate("/global/workflow/new")} size="sm">
          <Plus size={14} className="mr-1" />
          New Workflow
        </Button>
      </div>

      {!workflows || workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <GitBranch size={48} strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-foreground">No workflow templates</h3>
          <p>Create your first workflow template</p>
          <Button onClick={() => navigate("/global/workflow/new")} size="sm">
            <Plus size={14} className="mr-1" />
            Create Workflow
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <Card key={wf.id} className="p-5 hover:-translate-y-0.5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => navigate(`/global/workflow/${wf.id}`)}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GitBranch size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{wf.name}</h3>
                    <p className="text-xs text-muted-foreground">v{wf.version}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="default">{wf.steps.length} steps</Badge>
                </div>
              </div>
              {wf.description && (
                <p className="text-sm text-muted-foreground mb-4">{wf.description}</p>
              )}
              <div className="flex flex-col gap-2 mb-4">
                {wf.steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      {step.stepOrder}
                    </div>
                    <span className="text-sm text-foreground">{step.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{step.agentKey}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => navigate(`/global/workflow/${wf.id}`)}
                >
                  <Pencil size={12} className="mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => duplicateMutation.mutate(wf)}
                  disabled={duplicateMutation.isPending}
                >
                  <Copy size={12} className="mr-1" />
                  Duplicate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                  onClick={() => {
                    if (confirm("Delete this workflow template? This cannot be undone.")) {
                      deleteMutation.mutate(wf.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={12} className="mr-1" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
