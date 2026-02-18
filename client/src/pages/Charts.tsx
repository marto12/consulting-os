import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, Plus, Loader2, Trash2, Database, Calendar,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import ChartRenderer from "../components/ChartRenderer";

export default function Charts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [chartName, setChartName] = useState("");

  const { data: charts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/charts"],
    queryFn: () => fetch("/api/charts").then(r => r.json()),
  });

  const { data: datasets = [] } = useQuery<any[]>({
    queryKey: ["/api/data/datasets"],
    queryFn: () => fetch("/api/data/datasets").then(r => r.json()),
  });

  const generateMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["/api/charts"] });
      if (chartName && result.chart?.id) {
        fetch(`/api/charts/${result.chart.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: chartName }),
        }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/charts"] }));
      }
      setCreateOpen(false);
      setPrompt("");
      setChartName("");
      setSelectedDatasetId("");
      navigate(`/charts/${result.chart.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/charts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/charts"] }),
  });

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

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : charts.length === 0 ? (
        <Card className="p-12 text-center">
          <BarChart3 size={48} strokeWidth={1} className="mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No charts yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first chart by selecting a dataset and describing what you'd like to visualize.
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
              onClick={() => navigate(`/charts/${chart.id}`)}
              onDelete={() => deleteMutation.mutate(chart.id)}
            />
          ))}
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

function ChartCard({ chart, onClick, onDelete }: { chart: any; onClick: () => void; onDelete: () => void }) {
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={14} className="text-destructive" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-[10px]">{chart.chartType}</Badge>
          {chart.datasetId && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Database size={10} /> Dataset #{chart.datasetId}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
