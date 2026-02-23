import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Play, CheckCircle2, Loader2, Upload, Table } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";

type CGEResult = {
  headline: string;
  summary: string;
  metrics: { label: string; value: string }[];
  sectors: { name: string; impact: string }[];
  timeseries?: {
    gdp: { period: string; value: number }[];
    employment: { period: string; value: number }[];
  };
  spreadsheetId?: number;
  spreadsheetName?: string;
};

export default function CGEModel() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CGEResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedInput, setSelectedInput] = useState("baseline-2024");
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [savedChartId, setSavedChartId] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  const inputOptions = [
    { value: "baseline-2024", label: "Baseline 2024 (national accounts)" },
    { value: "mining-shock", label: "Mining shock 2024" },
    { value: "energy-transition", label: "Energy transition scenario" },
  ];

  const safeMetrics = result?.metrics ?? [];
  const safeSectors = result?.sectors ?? [];

  const metricChartData = useMemo(() => {
    if (!safeMetrics.length) return [];
    return safeMetrics.map((metric) => ({
      name: metric.label,
      value: Number.parseFloat(metric.value.replace(/[^0-9.-]/g, "")) || 0,
    }));
  }, [safeMetrics]);

  const sectorChartData = useMemo(() => {
    if (!safeSectors.length) return [];
    return safeSectors.map((sector) => ({
      name: sector.name,
      value: Number.parseFloat(sector.impact.replace(/[^0-9.-]/g, "")) || 0,
    }));
  }, [safeSectors]);

  const gdpSeries = result?.timeseries?.gdp ?? [];
  const employmentSeries = result?.timeseries?.employment ?? [];

  const combinedTimeseries = useMemo(() => {
    if (!result?.timeseries?.gdp?.length) return [];
    return result.timeseries.gdp.map((point, idx) => ({
      period: point.period,
      gdp: point.value,
      employment: result.timeseries?.employment?.[idx]?.value ?? 0,
    }));
  }, [result]);

  const progressLabel = useMemo(() => {
    if (status === "idle") return "Ready to run";
    if (status === "running") return "Running CGE simulation";
    if (status === "complete") return "Run complete";
    return "Run failed";
  }, [status]);

  const { data: projects = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/projects"],
  });

  const saveChartMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (chart) => {
      setSavedChartId(chart.id);
      if (selectedProject) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", Number(selectedProject), "charts"] });
      }
    },
  });

  const updateChartMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/charts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      if (selectedProject) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", Number(selectedProject), "charts"] });
      }
    },
  });

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const startRun = () => {
    if (!selectedProject) return;
    eventSourceRef.current?.close();
    setStatus("running");
    setMessages([]);
    setProgress(5);
    setResult(null);
    setShowResults(false);

    const source = new EventSource(`/api/models/cge/run-stream?projectId=${selectedProject}`);
    eventSourceRef.current = source;

    source.addEventListener("progress", (event) => {
      const text = (event as MessageEvent).data as string;
      if (text) {
        setMessages((prev) => [...prev, text]);
        setProgress((prev) => Math.min(95, prev + 18));
      }
    });

    source.addEventListener("complete", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const normalized: CGEResult = {
          headline: payload.headline || "CGE simulation complete",
          summary: payload.summary || "Scenario run finished successfully.",
          metrics: payload.metrics || [],
          sectors: payload.sectors || [],
          timeseries: payload.timeseries,
          spreadsheetId: payload.spreadsheetId,
          spreadsheetName: payload.spreadsheetName,
        };
        setResult(normalized);
        if (savedChartId && normalized?.timeseries) {
          const combined = normalized.timeseries?.gdp.map((point: { period: string; value: number }, idx: number) => ({
            period: point.period,
            gdp: point.value,
            employment: normalized.timeseries?.employment?.[idx]?.value ?? 0,
          }));
          updateChartMutation.mutate({
            id: savedChartId,
            payload: {
              chartConfig: {
                title: "CGE Time Series",
                description: `Updated from CGE run (${selectedInput})`,
                chartType: "line",
                xAxisKey: "period",
                yAxisKeys: ["gdp", "employment"],
                colors: ["#2563EB", "#10B981"],
                data: combined || [],
              },
            },
          });
        }
      } catch {
        setResult({
          headline: "CGE simulation complete",
          summary: "Scenario run finished successfully.",
          metrics: [],
          sectors: [],
        });
      }
      setProgress(100);
      setStatus("complete");
      source.close();
    });

    source.addEventListener("error", () => {
      setStatus("error");
      source.close();
    });
  };

  const saveChartToLibrary = () => {
    if (!selectedProject || !result?.timeseries) return;
    const chartPayload = {
      projectId: Number(selectedProject),
      name: "CGE Time Series",
      description: `CGE run (${selectedInput})`,
      chartType: "line",
      chartConfig: {
        title: "CGE Time Series",
        description: `Run input: ${selectedInput}`,
        chartType: "line",
        xAxisKey: "period",
        yAxisKeys: ["gdp", "employment"],
        colors: ["#2563EB", "#10B981"],
        data: combinedTimeseries,
      },
    };

    if (savedChartId) {
      updateChartMutation.mutate({ id: savedChartId, payload: chartPayload });
      return;
    }

    saveChartMutation.mutate(chartPayload);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CGE Model Runner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run a computable general equilibrium model to simulate sectoral shocks and macro impacts.
          </p>
        </div>
        <Button onClick={startRun} disabled={status === "running" || !selectedProject}>
          {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          <span className="ml-2">Run model</span>
        </Button>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold text-foreground">Attach to project</div>
        <p className="text-sm text-muted-foreground mt-1">
          Select the project this CGE run belongs to.
        </p>
        <div className="mt-4 max-w-md">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-semibold text-foreground">Input selection</div>
        <p className="text-sm text-muted-foreground mt-1">
          Choose an existing dataset or upload a new CGE input bundle.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing inputs</div>
            <Select value={selectedInput} onValueChange={setSelectedInput}>
              <SelectTrigger>
                <SelectValue placeholder="Select an input" />
              </SelectTrigger>
              <SelectContent>
                {inputOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upload new</div>
            <label className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:border-primary/60">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>{uploadName ?? "Upload CGE input bundle (.zip)"}</span>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".zip"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setUploadName(file ? file.name : null);
                }}
              />
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold text-foreground">Dummy CGE model</div>
          <Badge variant={status === "complete" ? "success" : status === "error" ? "destructive" : "secondary"}>
            {progressLabel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          This demo run uses a lightweight CGE script to emulate data loading, equilibrium solving,
          and scenario execution. Results are illustrative.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground w-10 text-right">{progress}%</span>
        </div>
        <div className="mt-4 space-y-2">
          {messages.length === 0 ? (
            <div className="text-xs text-muted-foreground">No updates yet.</div>
          ) : (
            messages.slice(-4).map((message, idx) => (
              <div key={`${message}-${idx}`} className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                <span>{message}</span>
              </div>
            ))
          )}
          {status === "running" && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="animate-pulse">Simulation running...</span>
            </div>
          )}
        </div>
      </Card>

      {status === "complete" && result && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <div>
                <div className="text-sm font-semibold text-foreground">Run complete</div>
                <p className="text-xs text-muted-foreground">{result.headline}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result.spreadsheetId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/sheet/${result.spreadsheetId}`)}
                >
                  <Table className="h-4 w-4 mr-2" />
                  Open spreadsheet{result.spreadsheetName ? `: ${result.spreadsheetName}` : ""}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowResults((prev) => !prev)}>
                {showResults ? "Hide results" : "View results"}
              </Button>
            </div>
          </div>

          {showResults && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">{result.summary || "Scenario run finished successfully."}</p>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Save this chart to the project library for reuse in documents and presentations.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveChartToLibrary}
                  disabled={!selectedProject || !result?.timeseries || saveChartMutation.isPending || updateChartMutation.isPending}
                >
                  {savedChartId ? "Update chart" : "Save to library"}
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key metrics</div>
                  <div className="mt-3 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricChartData} barSize={24}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} height={50} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sector impacts</div>
                  <div className="mt-3 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorChartData} barSize={24}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} height={50} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GDP index</div>
                  <div className="mt-3 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={gdpSeries}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment index</div>
                  <div className="mt-3 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={employmentSeries}>
                        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {safeMetrics.map((metric) => (
                  <Card key={metric.label} className="p-3">
                    <div className="text-xs text-muted-foreground">{metric.label}</div>
                    <div className="text-sm font-semibold text-foreground mt-1">{metric.value}</div>
                  </Card>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sector impacts</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {safeSectors.map((sector) => (
                    <Card key={sector.name} className="p-3">
                      <div className="text-xs text-muted-foreground">{sector.name}</div>
                      <div className="text-sm font-semibold text-foreground mt-1">{sector.impact}</div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
