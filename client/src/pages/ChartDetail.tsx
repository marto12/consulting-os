import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, Download, RefreshCw, Code, Database,
  Pencil, Save, BarChart3,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Separator } from "../components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import ChartRenderer from "../components/ChartRenderer";

export default function ChartDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState("");

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

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/charts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charts"] });
      setEditing(false);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (data: { datasetId: number; prompt: string }) => {
      const res = await fetch("/api/charts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      navigate(`/charts/${result.chart.id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (!chart && !chartWithData?.chart) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Chart not found</p>
        <Button variant="outline" onClick={() => navigate("/charts")}>
          <ArrowLeft size={16} className="mr-2" /> Back to Charts
        </Button>
      </div>
    );
  }

  const c = chart || chartWithData?.chart;
  const rows = chartWithData?.rows || [];
  const config = c?.chartConfig || {};

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="sticky top-0 z-20 flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/charts")}>
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
          <Badge variant="secondary">{c.chartType}</Badge>
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

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <Card className="overflow-hidden">
            <ChartRenderer
              config={config}
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
                {JSON.stringify(config, null, 2)}
              </pre>
            </Card>
          )}
        </div>
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
