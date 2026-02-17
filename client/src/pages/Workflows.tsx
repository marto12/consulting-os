import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { GitBranch, ChevronRight, Loader2, Bot } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  version: number;
  steps: { id: number; stepOrder: number; name: string; agentKey: string }[];
}

export default function Workflows() {
  const { data: workflows, isLoading } = useQuery<WorkflowTemplate[]>({
    queryKey: ["/api/workflows"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Workflow Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">Reusable agent pipelines for projects</p>
      </div>

      {!workflows || workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <GitBranch size={48} strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-foreground">No workflow templates</h3>
          <p>Templates will be created automatically</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <Card key={wf.id} className="p-5 hover:-translate-y-0.5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GitBranch size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{wf.name}</h3>
                    <p className="text-xs text-muted-foreground">v{wf.version}</p>
                  </div>
                </div>
                <Badge variant="default">{wf.steps.length} steps</Badge>
              </div>
              {wf.description && (
                <p className="text-sm text-muted-foreground mb-4">{wf.description}</p>
              )}
              <div className="flex flex-col gap-2">
                {wf.steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      {step.stepOrder}
                    </div>
                    <span className="text-sm text-foreground">{step.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{step.agentKey}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
