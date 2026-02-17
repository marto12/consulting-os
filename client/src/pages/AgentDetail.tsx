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
}

export default function AgentDetail() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [editPrompt, setEditPrompt] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editMaxTokens, setEditMaxTokens] = useState("");
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
      setHasChanges(false);
    }
  }, [agent]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/agent-configs/${key}`, {
        systemPrompt: editPrompt,
        model: editModel,
        maxTokens: parseInt(editMaxTokens) || 8192,
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
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/agents")}>
          <ChevronLeft size={16} />
          Agents
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: agent.roleColor + "20" }}
        >
          <Bot size={28} style={{ color: agent.roleColor }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{agent.name}</h1>
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
          <div className="grid grid-cols-2 gap-4 mb-4">
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
