import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  BarChart3, Plus, Loader2, Trash2, Database,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import ChartRenderer from "../components/ChartRenderer";
import { useUserContext } from "../lib/user-context";

export default function Charts() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const projectId = id ? Number(id) : undefined;
  const { activeUser, users } = useUserContext();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [chartName, setChartName] = useState("");

  const { data: charts = [], isLoading: loadingCharts } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "charts"],
    queryFn: () => fetch(`/api/projects/${projectId}/charts`).then(r => r.json()),
    enabled: !!projectId,
  });

  const { data: sharedCharts = [], isLoading: loadingShared } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "charts", "shared"],
    queryFn: () => fetch(`/api/projects/${projectId}/charts/shared`).then(r => r.json()),
    enabled: !!projectId,
  });

  const { data: datasets = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "datasets"],
    queryFn: () => fetch(`/api/projects/${projectId}/datasets`).then(r => r.json()),
    enabled: !!projectId,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { datasetId: number; prompt: string }) => {
      const res = await fetch("/api/charts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, projectId, lastEditedByUserId: activeUser?.id || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "charts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "charts", "shared"] });
      if (chartName && result.chart?.id) {
        fetch(`/api/charts/${result.chart.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: chartName, lastEditedByUserId: activeUser?.id || null }),
        }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "charts"] }));
      }
      setCreateOpen(false);
      setPrompt("");
      setChartName("");
      setSelectedDatasetId("");
      if (projectId) {
        navigate(`/project/${projectId}/charts/${result.chart.id}`);
      } else {
        navigate(`/charts/${result.chart.id}`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (chartId: number) => {
      await fetch(`/api/charts/${chartId}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "charts"] }),
  });

  const linkMutation = useMutation({
    mutationFn: async (chartId: number) => {
      await fetch(`/api/projects/${projectId}/charts/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "charts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "charts", "shared"] });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (chartId: number) => {
      await fetch(`/api/projects/${projectId}/charts/link/${chartId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "charts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "charts", "shared"] });
    },
  });

  const userLookup = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  if (!projectId) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Card className="p-10 text-center">
          <BarChart3 size={48} strokeWidth={1} className="mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Select a project to view charts</h3>
          <p className="text-sm text-muted-foreground">Charts are organized by project.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Charts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated visualizations linked to your datasets
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-2" />
          New Chart
        </Button>
      </div>

      {loadingCharts ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={`chart-skeleton-${idx}`} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-4" />
                  </div>
                  <Skeleton className="h-24 w-full mb-3" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-2/3 mt-2" />
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Project Charts</h2>
              <Badge variant="secondary" className="text-[10px]">{charts.length}</Badge>
            </div>
            {charts.length === 0 ? (
              <Card className="p-10 text-center">
                <BarChart3 size={42} strokeWidth={1} className="mx-auto mb-3 text-muted-foreground opacity-50" />
                <h3 className="text-base font-semibold mb-1">No charts yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a chart from your datasets or link a shared chart.
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus size={16} className="mr-2" />
                  Create Chart
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {charts.map((chart: any) => (
                  <ChartCard
                    key={chart.id}
                    chart={chart}
                    onClick={() => navigate(`/project/${projectId}/charts/${chart.id}`)}
                    onDelete={() => {
                      if (chart.projectId) {
                        deleteMutation.mutate(chart.id);
                      } else {
                        unlinkMutation.mutate(chart.id);
                      }
                    }}
                    deleteLabel={chart.projectId ? "Delete" : "Unlink"}
                    showSharedBadge={!chart.projectId}
                    editorName={chart.lastEditedByUserId ? userLookup.get(chart.lastEditedByUserId) : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shared Charts</h2>
              <Badge variant="secondary" className="text-[10px]">{sharedCharts.length}</Badge>
            </div>
            {loadingShared ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : sharedCharts.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No shared charts available.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sharedCharts.map((chart: any) => (
                  <ChartCard
                    key={chart.id}
                    chart={chart}
                    onClick={() => navigate(`/charts/${chart.id}`)}
                    actionLabel="Use in project"
                    onAction={() => linkMutation.mutate(chart.id)}
                    showSharedBadge
                    editorName={chart.lastEditedByUserId ? userLookup.get(chart.lastEditedByUserId) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate New Chart</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Dataset</label>
              <Select value={selectedDatasetId} onValueChange={setSelectedDatasetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds: any) => (
                    <SelectItem key={ds.id} value={String(ds.id)}>
                      {ds.name} {ds.rowCount > 0 && `(${ds.rowCount} rows)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Chart Name (optional)</label>
              <Input
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
                placeholder="e.g., Revenue by Quarter"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">What would you like to visualize?</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Show me a bar chart of sales by region"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => generateMutation.mutate({ datasetId: Number(selectedDatasetId), prompt })}
              disabled={!selectedDatasetId || !prompt || generateMutation.isPending}
            >
              {generateMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <BarChart3 size={16} className="mr-2" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChartCard({
  chart,
  onClick,
  onDelete,
  deleteLabel = "Delete",
  showSharedBadge,
  actionLabel,
  onAction,
  editorName,
}: {
  chart: any;
  onClick: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  showSharedBadge?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  editorName?: string;
}) {
  const { data: chartData } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/charts", chart.id, "data"],
    queryFn: () => fetch(`/api/charts/${chart.id}/data`).then(r => r.json()),
  });

  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group" onClick={onClick}>
      <div className="h-48 bg-muted/30 overflow-hidden">
        {chartData?.rows && chartData.rows.length > 0 ? (
          <div className="pointer-events-none scale-90 origin-top">
            <ChartRenderer config={chart.chartConfig} data={chartData.rows} height={180} showDownload={false} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <BarChart3 size={40} strokeWidth={1} className="opacity-30" />
          </div>
        )}
      </div>
      <div className="p-4 border-t">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{chart.name}</h3>
            {chart.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{chart.description}</p>
            )}
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title={deleteLabel}
            >
              <Trash2 size={14} className="text-destructive" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-[10px]">{chart.chartType}</Badge>
          {showSharedBadge && (
            <Badge variant="outline" className="text-[10px]">Shared</Badge>
          )}
          {chart.datasetId && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Database size={10} /> Dataset #{chart.datasetId}
            </span>
          )}
          {editorName && (
            <span className="text-[10px] text-muted-foreground ml-1">• {editorName}</span>
          )}
          {actionLabel && onAction && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-6 px-2 text-[10px]"
              onClick={(e) => { e.stopPropagation(); onAction(); }}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
