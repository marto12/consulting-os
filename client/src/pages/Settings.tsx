import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Bot, ChevronDown, ChevronUp, Save, Repeat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PIPELINE_STEPS = [
  {
    key: "issues_tree",
    step: 1,
    label: "Issues Tree",
    role: "Generator",
    roleColor: "#3B82F6",
    roleBg: "#EFF6FF",
    description: "Breaks down the objective into a structured MECE issues tree",
    detail: "Takes the project objective and constraints, produces a hierarchical tree of issues to investigate.",
  },
  {
    key: "mece_critic",
    step: 2,
    label: "MECE Critic",
    role: "Quality Gate",
    roleColor: "#8B5CF6",
    roleBg: "#F5F3FF",
    description: "Audits the issues tree for overlap, gaps, and quality",
    detail: "Scores the tree on 5 criteria (overlap, coverage, logic, balance, labels). Can send it back for up to 2 revisions.",
  },
  {
    key: "hypothesis",
    step: 3,
    label: "Hypothesis",
    role: "Analyst",
    roleColor: "#0891B2",
    roleBg: "#ECFEFF",
    description: "Generates testable hypotheses and analysis plans",
    detail: "Reads the approved issues tree and generates hypotheses with specific metrics, data sources, and methods.",
  },
  {
    key: "execution",
    step: 4,
    label: "Execution",
    role: "Tool Caller",
    roleColor: "#059669",
    roleBg: "#ECFDF5",
    description: "Runs the scenario calculator on each analysis plan",
    detail: "Calls the scenario calculator tool with financial parameters to produce baseline, optimistic, and pessimistic projections.",
  },
  {
    key: "summary",
    step: 5,
    label: "Summary",
    role: "Synthesizer",
    roleColor: "#D97706",
    roleBg: "#FFFBEB",
    description: "Writes the executive summary from all results",
    detail: "Produces a polished executive summary with key findings, recommendation, and next steps.",
  },
  {
    key: "presentation",
    step: 6,
    label: "Presentation",
    role: "Designer",
    roleColor: "#E11D48",
    roleBg: "#FFF1F2",
    description: "Generates a 16:9 slide deck from the analysis",
    detail: "Creates 6-10 structured slides with 5 layout types: title, section header, bullet points, two-column comparison, and metrics dashboard.",
  },
];

interface AgentConfig {
  id: number;
  agentType: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
  updatedAt: string;
}

export default function Settings() {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [editPrompts, setEditPrompts] = useState<Record<string, string>>({});
  const [editModels, setEditModels] = useState<Record<string, string>>({});
  const [editMaxTokens, setEditMaxTokens] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  const { data: configs, isLoading } = useQuery<AgentConfig[]>({
    queryKey: ["/api/agent-configs"],
  });

  useEffect(() => {
    if (configs) {
      const prompts: Record<string, string> = {};
      const models: Record<string, string> = {};
      const tokens: Record<string, string> = {};
      configs.forEach((c) => {
        prompts[c.agentType] = c.systemPrompt;
        models[c.agentType] = c.model;
        tokens[c.agentType] = String(c.maxTokens);
      });
      setEditPrompts(prompts);
      setEditModels(models);
      setEditMaxTokens(tokens);
      setHasChanges({});
    }
  }, [configs]);

  const saveMutation = useMutation({
    mutationFn: async (agentType: string) => {
      const res = await apiRequest("PUT", `/api/agent-configs/${agentType}`, {
        systemPrompt: editPrompts[agentType],
        model: editModels[agentType],
        maxTokens: parseInt(editMaxTokens[agentType]) || 8192,
      });
      return res.json();
    },
    onSuccess: (_data, agentType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-configs"] });
      setHasChanges((prev) => ({ ...prev, [agentType]: false }));
      window.alert("Configuration saved successfully");
    },
    onError: (err: any) => {
      window.alert(err.message || "Failed to save");
    },
  });

  const handlePromptChange = (agentType: string, value: string) => {
    setEditPrompts((prev) => ({ ...prev, [agentType]: value }));
    setHasChanges((prev) => ({ ...prev, [agentType]: true }));
  };

  const handleModelChange = (agentType: string, value: string) => {
    setEditModels((prev) => ({ ...prev, [agentType]: value }));
    setHasChanges((prev) => ({ ...prev, [agentType]: true }));
  };

  const handleMaxTokensChange = (agentType: string, value: string) => {
    setEditMaxTokens((prev) => ({ ...prev, [agentType]: value }));
    setHasChanges((prev) => ({ ...prev, [agentType]: true }));
  };

  const toggleExpand = (agentType: string) => {
    setExpandedAgent(expandedAgent === agentType ? null : agentType);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" data-testid="settings-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sortedConfigs = [...(configs || [])].sort((a, b) => {
    const ai = PIPELINE_STEPS.findIndex((s) => s.key === a.agentType);
    const bi = PIPELINE_STEPS.findIndex((s) => s.key === b.agentType);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div data-testid="settings-page">
      <p className="text-sm text-muted-foreground mb-6">Configure agents, prompts, and parameters</p>

      <Card className="mb-6" data-testid="pipeline-section">
        <CardHeader>
          <h2 className="text-lg font-semibold">Agent Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Each project runs through these stages in order. Human approval is required between stages.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-0">
            {PIPELINE_STEPS.map((step, idx) => (
              <div className="flex gap-4" key={step.key} data-testid={`pipeline-step-${step.key}`}>
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: step.roleColor }}
                  >
                    {step.step}
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="relative w-0.5 bg-border flex-1 mx-auto min-h-[32px]">
                      {step.key === "issues_tree" && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-0.5">
                          <Repeat size={11} color="#8B5CF6" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={cn("pb-4", idx === PIPELINE_STEPS.length - 1 && "pb-0")}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Bot size={16} color={step.roleColor} />
                    <span className="text-sm font-semibold">{step.label}</span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: step.roleBg, color: step.roleColor }}
                    >
                      {step.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mt-8 mb-4">Agent Configuration</h2>

      {sortedConfigs.map((config) => {
        const pipelineStep = PIPELINE_STEPS.find((s) => s.key === config.agentType);
        if (!pipelineStep) return null;
        const isExpanded = expandedAgent === config.agentType;
        const changed = hasChanges[config.agentType];
        const isSaving = saveMutation.isPending;

        return (
          <Card className="mb-3" key={config.agentType} data-testid={`agent-card-${config.agentType}`}>
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
              onClick={() => toggleExpand(config.agentType)}
              data-testid={`agent-header-${config.agentType}`}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: pipelineStep.roleBg }}
              >
                <Bot size={22} color={pipelineStep.roleColor} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{pipelineStep.label}</span>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: pipelineStep.roleBg, color: pipelineStep.roleColor }}
                  >
                    Step {pipelineStep.step} · {pipelineStep.role}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{pipelineStep.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {changed && (
                  <Badge variant="warning" data-testid={`unsaved-${config.agentType}`}>Unsaved</Badge>
                )}
                {isExpanded ? (
                  <ChevronUp size={20} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={20} className="text-muted-foreground" />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-border" data-testid={`agent-body-${config.agentType}`}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <Label>Model</Label>
                    <Input
                      value={editModels[config.agentType] || ""}
                      onChange={(e) => handleModelChange(config.agentType, e.target.value)}
                      placeholder="gpt-5-nano"
                      data-testid={`model-input-${config.agentType}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={editMaxTokens[config.agentType] || ""}
                      onChange={(e) => handleMaxTokensChange(config.agentType, e.target.value)}
                      placeholder="8192"
                      data-testid={`tokens-input-${config.agentType}`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <Label>System Prompt</Label>
                  <Textarea
                    className="min-h-[200px] font-mono text-sm"
                    value={editPrompts[config.agentType] || ""}
                    onChange={(e) => handlePromptChange(config.agentType, e.target.value)}
                    placeholder="Enter system prompt..."
                    data-testid={`prompt-input-${config.agentType}`}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {config.id > 0
                      ? `Last updated: ${new Date(config.updatedAt).toLocaleDateString()}`
                      : "Using default prompt"}
                  </span>
                  <Button
                    onClick={() => saveMutation.mutate(config.agentType)}
                    disabled={!changed || isSaving}
                    size="sm"
                    data-testid={`save-btn-${config.agentType}`}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save size={16} />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
