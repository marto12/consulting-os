import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { GitBranch, Database, Box, Package, Activity } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";

type Workflow = {
  id: number;
  name: string;
  description: string;
};

type Dataset = {
  id: number;
  name: string;
  description: string;
  rowCount: number;
};

type Model = {
  id: number;
  name: string;
  description: string;
};

export default function Assets() {
  const navigate = useNavigate();
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });
  const { data: datasets = [], isLoading: datasetsLoading } = useQuery<Dataset[]>({
    queryKey: ["/api/data/datasets"],
  });
  const { data: models = [], isLoading: modelsLoading } = useQuery<Model[]>({
    queryKey: ["/api/data/models"],
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="size-4" />
          Library
        </div>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared workflows, datasets, and models available across projects.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Agentic workflows</h2>
            <p className="text-sm text-muted-foreground">Reusable pipelines for project execution.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{workflows.length} total</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/global/workflow/new")}>New</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/global/workflows")}>Upload</Button>
          </div>
        </div>
        {workflowsLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading workflows...</Card>
        ) : workflows.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No workflows available.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                className="p-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
                onClick={() => navigate(`/global/workflow/${workflow.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GitBranch className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{workflow.name}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {workflow.description || "No description"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Datasets</h2>
            <p className="text-sm text-muted-foreground">Shared data sources available for analysis.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{datasets.length} total</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/global/datasets")}>New</Button>
          </div>
        </div>
        {datasetsLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading datasets...</Card>
        ) : datasets.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No datasets available.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {datasets.map((dataset) => (
              <Card
                key={dataset.id}
                className="p-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
                onClick={() => navigate(`/global/datasets`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{dataset.name}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {dataset.description || "No description"}
                    </p>
                    <div className="mt-1 text-[11px] text-muted-foreground">{dataset.rowCount} rows</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Models</h2>
            <p className="text-sm text-muted-foreground">Reusable model definitions and configs.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{models.length} total</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/global/models")}>New</Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card
            className="p-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
            onClick={() => navigate("/shared/cge-model")}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">CGE Model Runner</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  Run a computable general equilibrium demo workflow.
                </p>
                <div className="mt-2 text-[11px] text-muted-foreground">Demo run</div>
              </div>
            </div>
          </Card>
        </div>
        {modelsLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading models...</Card>
        ) : models.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No models available.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {models.map((model) => (
              <Card key={model.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Box className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{model.name}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {model.description || "No description"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
