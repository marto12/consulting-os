import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Activity, GitBranch, Database, Package, Trash2 } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { apiRequest, queryClient } from "../lib/query-client";

type Workflow = {
  id: number;
  name: string;
  description: string;
};

type Dataset = {
  id: number;
  projectId?: number | null;
  name: string;
  description: string;
  rowCount: number;
};

export default function Assets() {
  const navigate = useNavigate();
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });
  const { data: datasets = [], isLoading: datasetsLoading } = useQuery<Dataset[]>({
    queryKey: ["/api/data/datasets"],
  });

  const globalDatasets = datasets.filter((dataset) => !dataset.projectId);

  const deleteDataset = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/data/datasets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets"] });
    },
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
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Workflow</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((workflow) => (
                    <tr
                      key={workflow.id}
                      className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/global/workflow/${workflow.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <GitBranch className="size-4 text-primary" />
                          <span className="font-semibold text-foreground truncate">{workflow.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2">{workflow.description || "No description"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Models</h2>
            <p className="text-sm text-muted-foreground">Reusable analytical models for simulations.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">1 featured</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/global/models")}>Library</Button>
          </div>
        </div>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate("/shared/cge-model")}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Activity className="size-4 text-primary" />
                      <span className="font-semibold text-foreground truncate">CGE Economic Model</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="line-clamp-2">Run computable general equilibrium simulations and export results.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Datasets</h2>
            <p className="text-sm text-muted-foreground">Shared data sources available for analysis.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{globalDatasets.length} total</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/global/datasets")}>New</Button>
          </div>
        </div>
        {datasetsLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading datasets...</Card>
        ) : globalDatasets.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No datasets available.</Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Dataset</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Rows</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {globalDatasets.map((dataset) => (
                    <tr
                      key={dataset.id}
                      className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/global/datasets/${dataset.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Database className="size-4 text-primary" />
                          <span className="font-semibold text-foreground truncate">{dataset.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2">{dataset.description || "No description"}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{dataset.rowCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (confirm(`Delete "${dataset.name}"? This will remove all data.`)) {
                                deleteDataset.mutate(dataset.id);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

    </div>
  );
}
