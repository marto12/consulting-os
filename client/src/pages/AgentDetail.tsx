import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { ChevronLeft, Bot, Save, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { getAvatarGradient } from "../lib/avatar-utils";

interface AgentDetailData {
  id: number;
  key: string;
  name: string;
  description: string;
  role: string;
  roleColor: string;
  model: string;
  maxTokens: number;
  promptTemplate: string;
  systemPrompt: string;
  configModel: string;
  configMaxTokens: number;
  configTemperature: number;
  configTopP: number;
  configPresencePenalty: number;
  configFrequencyPenalty: number;
  configMaxIterations: number;
  configToolWhitelist: string;
  configToolCallBudget: number;
  configRetryCount: number;
  configTimeoutMs: number;
  configMemoryScope: string;
  configOutputSchema: string;
  configSafetyRules: string;
  configStopSequences: string;
  configStreaming: boolean;
  configParallelism: number;
  configCacheTtlSeconds: number;
}

export default function AgentDetail() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [editPrompt, setEditPrompt] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editMaxTokens, setEditMaxTokens] = useState("");
  const [editTemperature, setEditTemperature] = useState("");
  const [editTopP, setEditTopP] = useState("");
  const [editPresencePenalty, setEditPresencePenalty] = useState("");
  const [editFrequencyPenalty, setEditFrequencyPenalty] = useState("");
  const [editMaxIterations, setEditMaxIterations] = useState("");
  const [editToolWhitelist, setEditToolWhitelist] = useState("");
  const [editToolCallBudget, setEditToolCallBudget] = useState("");
  const [editRetryCount, setEditRetryCount] = useState("");
  const [editTimeoutMs, setEditTimeoutMs] = useState("");
  const [editMemoryScope, setEditMemoryScope] = useState("project");
  const [editOutputSchema, setEditOutputSchema] = useState("");
  const [editSafetyRules, setEditSafetyRules] = useState("");
  const [editStopSequences, setEditStopSequences] = useState("");
  const [editStreaming, setEditStreaming] = useState(false);
  const [editParallelism, setEditParallelism] = useState("");
  const [editCacheTtlSeconds, setEditCacheTtlSeconds] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: agent, isLoading } = useQuery<AgentDetailData>({
    queryKey: ["/api/agents/detail", key],
    enabled: !!key,
  });

  useEffect(() => {
    if (agent) {
      setEditPrompt(agent.systemPrompt || agent.promptTemplate || "");
      setEditModel(agent.configModel || agent.model || "gpt-5-nano");
      setEditMaxTokens(String(agent.configMaxTokens || agent.maxTokens || 8192));
      setEditTemperature(String(agent.configTemperature ?? 0.2));
      setEditTopP(String(agent.configTopP ?? 1));
      setEditPresencePenalty(String(agent.configPresencePenalty ?? 0));
      setEditFrequencyPenalty(String(agent.configFrequencyPenalty ?? 0));
      setEditMaxIterations(String(agent.configMaxIterations ?? 4));
      setEditToolWhitelist(agent.configToolWhitelist || "");
      setEditToolCallBudget(String(agent.configToolCallBudget ?? 6));
      setEditRetryCount(String(agent.configRetryCount ?? 1));
      setEditTimeoutMs(String(agent.configTimeoutMs ?? 60000));
      setEditMemoryScope(agent.configMemoryScope || "project");
      setEditOutputSchema(agent.configOutputSchema || "");
      setEditSafetyRules(agent.configSafetyRules || "");
      setEditStopSequences(agent.configStopSequences || "");
      setEditStreaming(Boolean(agent.configStreaming));
      setEditParallelism(String(agent.configParallelism ?? 1));
      setEditCacheTtlSeconds(String(agent.configCacheTtlSeconds ?? 0));
      setHasChanges(false);
    }
  }, [agent]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/agent-configs/${key}`, {
        systemPrompt: editPrompt,
        model: editModel,
        maxTokens: parseInt(editMaxTokens) || 8192,
        temperature: parseFloat(editTemperature),
        topP: parseFloat(editTopP),
        presencePenalty: parseFloat(editPresencePenalty),
        frequencyPenalty: parseFloat(editFrequencyPenalty),
        maxIterations: parseInt(editMaxIterations) || 4,
        toolWhitelist: editToolWhitelist || null,
        toolCallBudget: parseInt(editToolCallBudget) || 6,
        retryCount: parseInt(editRetryCount) || 1,
        timeoutMs: parseInt(editTimeoutMs) || 60000,
        memoryScope: editMemoryScope,
        outputSchema: editOutputSchema || null,
        safetyRules: editSafetyRules || null,
        stopSequences: editStopSequences || null,
        streaming: editStreaming,
        parallelism: parseInt(editParallelism) || 1,
        cacheTtlSeconds: parseInt(editCacheTtlSeconds) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/detail", key] });
      setHasChanges(false);
    },
  });

  if (isLoading || !agent) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-28" />
        <div className="flex items-center gap-3 sm:gap-4">
          <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Card className="mb-6">
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-5/6" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full sm:col-span-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/global/agents")}>
          <ChevronLeft size={16} />
          Agents
        </Button>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Avatar className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl">
          <AvatarFallback
            className="rounded-xl text-white"
            style={{ backgroundImage: getAvatarGradient(agent.name) }}
          >
            <Bot className="size-5 sm:size-6" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{agent.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: agent.roleColor + "20", color: agent.roleColor }}
            >
              {agent.role}
            </span>
            <span className="text-sm text-muted-foreground">{agent.key}</span>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h3 className="font-semibold">Description</h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{agent.description || "No description"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Configuration</h3>
            {hasChanges && <Badge variant="warning">Unsaved Changes</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input
                value={editModel}
                onChange={(e) => { setEditModel(e.target.value); setHasChanges(true); }}
                placeholder="gpt-5-nano"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={editMaxTokens}
                onChange={(e) => { setEditMaxTokens(e.target.value); setHasChanges(true); }}
                placeholder="8192"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.1"
                value={editTemperature}
                onChange={(e) => { setEditTemperature(e.target.value); setHasChanges(true); }}
                placeholder="0.2"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Top P</Label>
              <Input
                type="number"
                step="0.1"
                value={editTopP}
                onChange={(e) => { setEditTopP(e.target.value); setHasChanges(true); }}
                placeholder="1.0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Presence Penalty</Label>
              <Input
                type="number"
                step="0.1"
                value={editPresencePenalty}
                onChange={(e) => { setEditPresencePenalty(e.target.value); setHasChanges(true); }}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency Penalty</Label>
              <Input
                type="number"
                step="0.1"
                value={editFrequencyPenalty}
                onChange={(e) => { setEditFrequencyPenalty(e.target.value); setHasChanges(true); }}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Iterations</Label>
              <Input
                type="number"
                value={editMaxIterations}
                onChange={(e) => { setEditMaxIterations(e.target.value); setHasChanges(true); }}
                placeholder="4"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Retry Count</Label>
              <Input
                type="number"
                value={editRetryCount}
                onChange={(e) => { setEditRetryCount(e.target.value); setHasChanges(true); }}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={editTimeoutMs}
                onChange={(e) => { setEditTimeoutMs(e.target.value); setHasChanges(true); }}
                placeholder="60000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parallelism</Label>
              <Input
                type="number"
                value={editParallelism}
                onChange={(e) => { setEditParallelism(e.target.value); setHasChanges(true); }}
                placeholder="1"
              />
            </div>
          </div>

          <div className="space-y-1.5 mb-4">
            <Label>System Prompt</Label>
            <Textarea
              className="min-h-[200px] font-mono text-sm"
              value={editPrompt}
              onChange={(e) => { setEditPrompt(e.target.value); setHasChanges(true); }}
              placeholder="Enter system prompt..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label>Tool Call Budget</Label>
              <Input
                type="number"
                value={editToolCallBudget}
                onChange={(e) => { setEditToolCallBudget(e.target.value); setHasChanges(true); }}
                placeholder="6"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Memory Scope</Label>
              <Select value={editMemoryScope} onValueChange={(value) => { setEditMemoryScope(value); setHasChanges(true); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="session">Session</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cache TTL (seconds)</Label>
              <Input
                type="number"
                value={editCacheTtlSeconds}
                onChange={(e) => { setEditCacheTtlSeconds(e.target.value); setHasChanges(true); }}
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={editStreaming}
                onChange={(e) => { setEditStreaming(e.target.checked); setHasChanges(true); }}
                className="h-4 w-4 rounded border border-input"
              />
              <Label>Enable streaming</Label>
            </div>
          </div>

          <div className="space-y-1.5 mb-4">
            <Label>Tool Whitelist (one per line)</Label>
            <Textarea
              className="min-h-[120px] font-mono text-sm"
              value={editToolWhitelist}
              onChange={(e) => { setEditToolWhitelist(e.target.value); setHasChanges(true); }}
              placeholder="run_scenario_tool\nsearch_documents"
            />
          </div>

          <div className="space-y-1.5 mb-4">
            <Label>Stop Sequences (one per line)</Label>
            <Textarea
              className="min-h-[120px] font-mono text-sm"
              value={editStopSequences}
              onChange={(e) => { setEditStopSequences(e.target.value); setHasChanges(true); }}
              placeholder="</final>\nEND"
            />
          </div>

          <div className="space-y-1.5 mb-4">
            <Label>Output Schema (JSON)</Label>
            <Textarea
              className="min-h-[160px] font-mono text-sm"
              value={editOutputSchema}
              onChange={(e) => { setEditOutputSchema(e.target.value); setHasChanges(true); }}
              placeholder='{"type":"object","properties":{}}'
            />
          </div>

          <div className="space-y-1.5 mb-4">
            <Label>Safety Rules</Label>
            <Textarea
              className="min-h-[120px] font-mono text-sm"
              value={editSafetyRules}
              onChange={(e) => { setEditSafetyRules(e.target.value); setHasChanges(true); }}
              placeholder="Avoid PII. Do not fabricate sources."
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Save size={16} /> Save Configuration</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
