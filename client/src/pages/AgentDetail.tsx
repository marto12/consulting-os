import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  LogIn,
  LogOut,
  Code,
  Wrench,
  Terminal,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgentField {
  name: string;
  type: string;
  description: string;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

interface AgentDetailData {
  key: string;
  label: string;
  role: string;
  roleColor: string;
  roleBg: string;
  stage: string;
  description: string;
  inputs: AgentField[];
  outputs: AgentField[];
  outputSchema: string;
  tools: ToolDef[];
  triggerStage: string;
  producesStage: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
}

function formatStage(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AgentDetail() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();

  const { data: agent, isLoading, error } = useQuery<AgentDetailData>({
    queryKey: ["/api/agents", key],
    enabled: !!key,
  });

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <AlertCircle size={40} className="text-destructive" />
          <h3>Agent not found</h3>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const promptLines = agent.systemPrompt.split("\n").length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex items-center gap-2">
          <Bot size={18} style={{ color: agent.roleColor }} />
          <span className="text-lg font-semibold">{agent.label}</span>
        </div>
        <div className="flex-1" />
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="h-1 w-full" style={{ backgroundColor: agent.roleColor }} />
          <div className="p-6">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: agent.roleBg, color: agent.roleColor }}
              >
                {agent.role}
              </span>
              <div className="text-right">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Stage</div>
                <div className="text-sm font-semibold mt-1">{formatStage(agent.stage)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Bot size={26} style={{ color: agent.roleColor }} />
              <span className="text-xl font-bold">{agent.label} Agent</span>
            </div>
            <div className="text-sm text-muted-foreground mt-2">{agent.description}</div>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Model</div>
            <div className="text-sm font-semibold mt-1 text-primary">{agent.model}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Max Tokens</div>
            <div className="text-sm font-semibold mt-1">{agent.maxTokens.toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Trigger</div>
            <div className="text-sm font-semibold mt-1 text-emerald-500">{formatStage(agent.triggerStage)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Produces</div>
            <div className="text-sm font-semibold mt-1 text-amber-500">{formatStage(agent.producesStage)}</div>
          </Card>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <LogIn size={16} />
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Inputs</span>
        </div>
        {agent.inputs.map((field) => (
          <Card key={field.name} className="p-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{field.name}</span>
              <Badge variant="secondary">{field.type}</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">{field.description}</div>
          </Card>
        ))}

        <div className="flex items-center gap-2 mt-6">
          <LogOut size={16} />
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Outputs</span>
        </div>
        {agent.outputs.map((field) => (
          <Card key={field.name} className="p-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{field.name}</span>
              <Badge variant="secondary">{field.type}</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">{field.description}</div>
          </Card>
        ))}

        <div className="flex items-center gap-2 mt-6">
          <Code size={16} />
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Output Schema</span>
        </div>
        <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-xs font-mono text-slate-300">{agent.outputSchema}</pre>
        </div>

        {agent.tools.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-6">
              <Wrench size={16} />
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tools</span>
            </div>
            {agent.tools.map((tool) => (
              <Card key={tool.name} className="p-4">
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-emerald-500" />
                  <span className="font-mono text-sm font-medium">{tool.name}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{tool.description}</div>
                {Object.keys(tool.parameters).length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parameters</div>
                    {Object.entries(tool.parameters).map(([param, desc]) => (
                      <div key={param} className="flex gap-2 text-sm">
                        <span className="font-mono font-medium text-primary">{param}</span>
                        <span className="text-muted-foreground">{desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </>
        )}

        <div className="flex items-center gap-2 mt-6">
          <Terminal size={16} />
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">System Prompt</span>
        </div>
        <Card className="overflow-hidden">
          <div className="text-xs text-muted-foreground px-4 py-2 bg-muted border-b border-border">
            {promptLines} lines | {agent.systemPrompt.length} chars
          </div>
          <div className="max-h-[400px] overflow-y-auto p-4">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">{agent.systemPrompt}</pre>
          </div>
        </Card>
      </div>
    </div>
  );
}
