import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Box, ChevronLeft, Loader2, Play } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { useUserContext } from "../lib/user-context";
import { apiRequest } from "../lib/query-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";

interface Model {
  id: number;
  projectId: number | null;
  lastEditedByUserId?: number | null;
  name: string;
  description: string;
  inputSchema?: any;
  outputSchema?: any;
  apiConfig?: any;
  createdAt: string;
  updatedAt?: string;
}

export default function ModelDetail() {
  const { id, modelId } = useParams<{ id?: string; modelId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isGlobal = location.pathname.startsWith("/global/");
  const numericId = modelId ? Number(modelId) : Number.NaN;
  const projectId = !isGlobal && id ? Number(id) : undefined;
  const backPath = isGlobal ? "/global/models" : projectId ? `/project/${projectId}/models` : "/models";
  const { users } = useUserContext();
  const userLookup = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const [runInput, setRunInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const modelQuery = useQuery<Model>({
    queryKey: ["/api/data/models", numericId],
    queryFn: async () => {
      const res = await fetch(`/api/data/models/${numericId}`);
      if (!res.ok) throw new Error("Failed to load model");
      return res.json();
    },
    enabled: Number.isFinite(numericId),
  });

  const runModel = useMutation({
    mutationFn: async ({ modelId, input }: { modelId: number; input: any }) => {
      const res = await apiRequest("POST", `/api/models/${modelId}/run`, input);
      return res.json();
    },
  });

  if (!Number.isFinite(numericId)) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">Invalid model id.</div>
      </Card>
    );
  }

  if (modelQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (modelQuery.isError || !modelQuery.data) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">Model not found.</div>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(backPath)}>
          <ChevronLeft size={14} className="mr-1" />
          Back to models
        </Button>
      </Card>
    );
  }

  const model = modelQuery.data;
  const editedBy = model.lastEditedByUserId ? userLookup.get(model.lastEditedByUserId) : null;
  const formatJson = (value: any) => (value ? JSON.stringify(value, null, 2) : "No configuration");
  const hasApiConfig = !!model.apiConfig;
  const placeholderText = `{
  "param": "value"
}`;

  useEffect(() => {
    if (runInput) return;
    const sample = model.apiConfig?.sampleInput ?? {};
    setRunInput(JSON.stringify(sample, null, 2));
  }, [model.apiConfig, runInput]);

  const handleRun = () => {
    try {
      const parsed = runInput ? JSON.parse(runInput) : {};
      setInputError(null);
      runModel.mutate({ modelId: model.id, input: parsed });
    } catch {
      setInputError("Input must be valid JSON.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Box className="size-4" />
            Model
          </div>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{model.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{model.description || "No description"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(backPath)}>
          <ChevronLeft size={14} className="mr-1" />
          Back to models
        </Button>
      </div>

      <Tabs defaultValue="run" className="space-y-4">
        <TabsList>
          <TabsTrigger value="run">Run</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="run">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Input</div>
                <Badge variant="outline" className="text-[10px] capitalize">JSON</Badge>
              </div>
              <Textarea
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                rows={12}
                className="font-mono text-xs"
                placeholder={placeholderText}
              />
              {inputError && <div className="text-xs text-destructive">{inputError}</div>}
              {!hasApiConfig && (
                <div className="text-xs text-muted-foreground">Add API config in Settings to enable runs.</div>
              )}
              <Button onClick={handleRun} disabled={!hasApiConfig || runModel.isPending}>
                {runModel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span className="ml-2">Run Model</span>
              </Button>
              {runModel.error && (
                <div className="text-xs text-destructive">
                  {runModel.error instanceof Error ? runModel.error.message : "Run failed."}
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">Output</div>
              <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                {runModel.data?.output ? JSON.stringify(runModel.data.output, null, 2) : "Run the model to see output."}
              </pre>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Details</div>
                <Badge variant="outline" className="text-[10px] capitalize">{model.projectId ? "project" : "shared"}</Badge>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                {editedBy && (
                  <div className="flex items-center justify-between">
                    <span>Last edited by</span>
                    <span className="text-foreground">{editedBy}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Created</span>
                  <span className="text-foreground">{new Date(model.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">API Config</div>
              <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">{formatJson(model.apiConfig)}</pre>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">Input Schema</div>
              <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">{formatJson(model.inputSchema)}</pre>
            </Card>
            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">Output Schema</div>
              <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">{formatJson(model.outputSchema)}</pre>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
