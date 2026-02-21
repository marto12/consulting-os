import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, RefreshCw, Code, Database,
  Pencil, Save, BarChart3, Settings2, X, Plus, Check,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import ChartRenderer from "../components/ChartRenderer";
import { useUserContext } from "../lib/user-context";

const CHART_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "pie", label: "Pie" },
  { value: "area", label: "Area" },
  { value: "scatter", label: "Scatter" },
];

const PRESET_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE",
  "#FF8042", "#00C49F", "#FFBB28", "#d84888", "#4888d8",
  "#48d888", "#d8d848", "#8848d8", "#d84848", "#48d8d8",
];

export default function ChartDetail() {
  const { id, projectId } = useParams<{ id: string; projectId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeUser } = useUserContext();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState("");

  const [localConfig, setLocalConfig] = useState<any>(null);
  const [configDirty, setConfigDirty] = useState(false);

  const { data: chartWithData, isLoading } = useQuery<{ chart: any; rows: any[] }>({
    queryKey: ["/api/charts", id, "data"],
    queryFn: () => fetch(`/api/charts/${id}/data`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: chart } = useQuery<any>({
    queryKey: ["/api/charts", id],
    queryFn: () => fetch(`/api/charts/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: dataset } = useQuery<any>({
    queryKey: ["/api/data/datasets", chart?.datasetId],
    queryFn: () => fetch(`/api/data/datasets`).then(r => r.json()).then((ds: any[]) => ds.find(d => d.id === chart?.datasetId)),
    enabled: !!chart?.datasetId,
  });

  const c = chart || chartWithData?.chart;
  const rows = chartWithData?.rows || [];

  useEffect(() => {
    if (c?.chartConfig && !localConfig) {
      setLocalConfig({ ...c.chartConfig });
    }
  }, [c?.chartConfig]);

  const availableColumns = localConfig?.availableColumns ||
    (rows.length > 0 ? Object.keys(rows[0]) : []);

  const numericColumns = availableColumns.filter((col: string) => {
    if (rows.length === 0) return true;
    const val = rows[0][col];
    return typeof val === "number" || (!isNaN(Number(val)) && val !== "" && val !== null);
  });

  const categoricalColumns = availableColumns.filter((col: string) => !numericColumns.includes(col));

  const updateConfig = useCallback((patch: Record<string, any>) => {
    setLocalConfig((prev: any) => ({ ...prev, ...patch }));
    setConfigDirty(true);
  }, []);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/charts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, lastEditedByUserId: activeUser?.id || null }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/charts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/charts", id, "data"] });
      setEditing(false);
      setConfigDirty(false);
    },
  });

  const saveConfig = useCallback(() => {
    if (!localConfig) return;
    updateMutation.mutate({
      chartType: localConfig.chartType,
      chartConfig: localConfig,
    });
  }, [localConfig, updateMutation]);

  const regenerateMutation = useMutation({
    mutationFn: async (data: { datasetId: number; prompt: string }) => {
      const res = await fetch("/api/charts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          projectId: projectId ? Number(projectId) : undefined,
          lastEditedByUserId: activeUser?.id || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (result) => {
      if (chart && result.chart) {
        fetch(`/api/charts/${chart.id}`, { method: "DELETE" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/charts"] });
      setRegenOpen(false);
      if (projectId) {
        navigate(`/project/${projectId}/charts/${result.chart.id}`);
      } else {
        navigate(`/charts/${result.chart.id}`);
      }
    },
  });

  const toggleSeries = useCallback((col: string) => {
    setLocalConfig((prev: any) => {
      const yKeys = [...(prev.yAxisKeys || [])];
      const colors = [...(prev.colors || [])];
      const idx = yKeys.indexOf(col);
      if (idx >= 0) {
        if (yKeys.length <= 1) return prev;
        yKeys.splice(idx, 1);
        colors.splice(idx, 1);
      } else {
        yKeys.push(col);
        const usedColors = new Set(colors);
        const newColor = PRESET_COLORS.find(c => !usedColors.has(c)) || PRESET_COLORS[yKeys.length % PRESET_COLORS.length];
        colors.push(newColor);
      }
      return {
        ...prev,
        yAxisKeys: yKeys,
        yAxisLabel: yKeys.join(", "),
        colors,
        title: `${yKeys.join(", ")} by ${prev.xAxisKey}`,
      };
    });
    setConfigDirty(true);
  }, []);

  const updateSeriesColor = useCallback((idx: number, color: string) => {
    setLocalConfig((prev: any) => {
      const colors = [...(prev.colors || [])];
      colors[idx] = color;
      return { ...prev, colors };
    });
    setConfigDirty(true);
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <Card className="p-4">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-[280px] w-full" />
        </Card>
        <Card className="p-4">
          <Skeleton className="h-5 w-32 mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full md:col-span-2" />
          </div>
        </Card>
      </div>
    );
  }

  const backPath = projectId ? `/project/${projectId}/charts` : "/charts";

  if (!c) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Chart not found</p>
        <Button variant="outline" onClick={() => navigate(backPath)}>
          <ArrowLeft size={16} className="mr-2" /> Back to Charts
        </Button>
      </div>
    );
  }

  const activeConfig = localConfig || c.chartConfig || {};

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="sticky top-0 z-20 flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft size={16} />
        </Button>
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="max-w-xs h-8 text-sm font-semibold"
              autoFocus
            />
            <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ name: editName, description: editDesc })}>
              <Save size={14} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{c.name}</h1>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditName(c.name); setEditDesc(c.description || ""); setEditing(true); }}>
              <Pencil size={12} />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Badge variant="secondary">{activeConfig.chartType || c.chartType}</Badge>
          {configDirty && (
            <Button size="sm" onClick={saveConfig} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
              Save
            </Button>
          )}
          <Button variant={showControls ? "default" : "outline"} size="sm" onClick={() => setShowControls(!showControls)}>
            <Settings2 size={14} className="mr-1.5" />
            {showControls ? "Hide" : "Edit"} Chart
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCode(!showCode)}>
            <Code size={14} className="mr-1.5" />
            {showCode ? "Hide" : "Show"} Config
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setRegenPrompt(""); setRegenOpen(true); }}>
            <RefreshCw size={14} className="mr-1.5" />
            Regenerate
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6 space-y-6">
            <Card className="overflow-hidden">
              <ChartRenderer
                config={activeConfig}
                data={rows}
                height={400}
                showDownload={true}
                chartName={c.name}
              />
            </Card>

            {editing && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <Textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Chart description..."
                  rows={2}
                />
              </div>
            )}

            {c.description && !editing && (
              <p className="text-sm text-muted-foreground">{c.description}</p>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {dataset && (
                <span className="flex items-center gap-1.5">
                  <Database size={14} />
                  Linked to: <span className="text-foreground font-medium">{dataset.name}</span>
                  {dataset.rowCount > 0 && <Badge variant="outline" className="text-[10px] ml-1">{dataset.rowCount} rows</Badge>}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <BarChart3 size={14} />
                {rows.length} data points rendered
              </span>
            </div>

            <Separator />

            {showCode && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Code size={14} />
                  Chart Configuration
                </h3>
                <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                  {JSON.stringify(activeConfig, null, 2)}
                </pre>
              </Card>
            )}
          </div>
        </div>

        {showControls && localConfig && (
          <div className="w-80 border-l bg-muted/20 overflow-y-auto shrink-0">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Chart Controls</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowControls(false)}>
                <X size={14} />
              </Button>
            </div>
            <div className="p-4 space-y-5">

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Chart Type</label>
                <Select
                  value={localConfig.chartType}
                  onValueChange={(val) => updateConfig({ chartType: val })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">X-Axis (Category)</label>
                <Select
                  value={localConfig.xAxisKey || ""}
                  onValueChange={(val) => updateConfig({ xAxisKey: val, xAxisLabel: val })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((col: string) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                  Series (Y-Axis)
                </label>
                <div className="space-y-1.5">
                  {numericColumns.map((col: string) => {
                    const active = (localConfig.yAxisKeys || []).includes(col);
                    const idx = (localConfig.yAxisKeys || []).indexOf(col);
                    const color = active ? (localConfig.colors || [])[idx] || PRESET_COLORS[0] : "";
                    return (
                      <div key={col} className="flex items-center gap-2 group">
                        <button
                          className={`flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left ${
                            active
                              ? "bg-primary/10 text-foreground border border-primary/30"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                          }`}
                          onClick={() => toggleSeries(col)}
                        >
                          {active ? (
                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                          ) : (
                            <Plus size={12} className="shrink-0 opacity-50" />
                          )}
                          <span className="truncate">{col}</span>
                          {active && <Check size={12} className="ml-auto shrink-0 text-primary" />}
                        </button>
                        {active && (
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => updateSeriesColor(idx, e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                            title={`Color for ${col}`}
                          />
                        )}
                      </div>
                    );
                  })}
                  {categoricalColumns.filter((col: string) => col !== localConfig.xAxisKey).map((col: string) => {
                    const active = (localConfig.yAxisKeys || []).includes(col);
                    const idx = (localConfig.yAxisKeys || []).indexOf(col);
                    const color = active ? (localConfig.colors || [])[idx] || PRESET_COLORS[0] : "";
                    return (
                      <div key={col} className="flex items-center gap-2 group">
                        <button
                          className={`flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left ${
                            active
                              ? "bg-primary/10 text-foreground border border-primary/30"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                          }`}
                          onClick={() => toggleSeries(col)}
                        >
                          {active ? (
                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                          ) : (
                            <Plus size={12} className="shrink-0 opacity-50" />
                          )}
                          <span className="truncate">{col}</span>
                          {active && <Check size={12} className="ml-auto shrink-0 text-primary" />}
                        </button>
                        {active && (
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => updateSeriesColor(idx, e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                            title={`Color for ${col}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {(localConfig.chartType === "bar" || localConfig.chartType === "area") && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Stacking</label>
                  <button
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors ${
                      localConfig.stacked
                        ? "bg-primary/10 text-foreground border border-primary/30"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
                    }`}
                    onClick={() => updateConfig({ stacked: !localConfig.stacked })}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${localConfig.stacked ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                      {localConfig.stacked && <Check size={10} className="text-primary-foreground" />}
                    </div>
                    Stacked
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">X-Axis Label</label>
                <Input
                  value={localConfig.xAxisLabel || ""}
                  onChange={(e) => updateConfig({ xAxisLabel: e.target.value })}
                  placeholder="X-axis label"
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Y-Axis Label</label>
                <Input
                  value={localConfig.yAxisLabel || ""}
                  onChange={(e) => updateConfig({ yAxisLabel: e.target.value })}
                  placeholder="Y-axis label"
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Title</label>
                <Input
                  value={localConfig.title || ""}
                  onChange={(e) => updateConfig({ title: e.target.value })}
                  placeholder="Chart title"
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Description</label>
                <Textarea
                  value={localConfig.description || ""}
                  onChange={(e) => updateConfig({ description: e.target.value })}
                  placeholder="Chart description"
                  rows={2}
                  className="text-sm"
                />
              </div>

              <Separator />

              <div className="pt-1">
                <Button
                  className="w-full"
                  onClick={saveConfig}
                  disabled={!configDirty || updateMutation.isPending}
                >
                  {updateMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Chart</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-1.5 block">New visualization prompt</label>
            <Textarea
              value={regenPrompt}
              onChange={(e) => setRegenPrompt(e.target.value)}
              placeholder="e.g., Make it a line chart instead, or add a second series"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button
              onClick={() => regenerateMutation.mutate({ datasetId: c.datasetId, prompt: regenPrompt || `Regenerate ${c.name}` })}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RefreshCw size={14} className="mr-2" />}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
