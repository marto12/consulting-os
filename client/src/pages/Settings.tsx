import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Bot, ChevronDown, ChevronUp, Save, Repeat } from "lucide-react";
import "./Settings.css";

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
      <div className="loading-center" data-testid="settings-loading">
        <div className="spinner" />
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
      <p className="settings-subtitle">Configure agents, prompts, and parameters</p>

      <div className="settings-section" data-testid="pipeline-section">
        <h2 className="settings-section-title">Agent Pipeline</h2>
        <p className="settings-section-subtitle">
          Each project runs through these stages in order. Human approval is required between stages.
        </p>
        <div className="pipeline-track">
          {PIPELINE_STEPS.map((step, idx) => (
            <div className="pipeline-step" key={step.key} data-testid={`pipeline-step-${step.key}`}>
              <div className="pipeline-step-left">
                <div className="pipeline-step-dot" style={{ backgroundColor: step.roleColor }}>
                  <span className="pipeline-step-num">{step.step}</span>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className="pipeline-connector">
                    {step.key === "issues_tree" && (
                      <div className="pipeline-loop-indicator">
                        <Repeat size={11} color="#8B5CF6" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="pipeline-step-content">
                <div className="pipeline-step-header">
                  <Bot size={16} color={step.roleColor} />
                  <span className="pipeline-step-label">{step.label}</span>
                  <span className="role-badge" style={{ backgroundColor: step.roleBg, color: step.roleColor }}>
                    {step.role}
                  </span>
                </div>
                <p className="pipeline-step-detail">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="config-section-title">Agent Configuration</h2>

      {sortedConfigs.map((config) => {
        const pipelineStep = PIPELINE_STEPS.find((s) => s.key === config.agentType);
        if (!pipelineStep) return null;
        const isExpanded = expandedAgent === config.agentType;
        const changed = hasChanges[config.agentType];
        const isSaving = saveMutation.isPending;

        return (
          <div className="agent-card" key={config.agentType} data-testid={`agent-card-${config.agentType}`}>
            <div
              className="agent-header"
              onClick={() => toggleExpand(config.agentType)}
              data-testid={`agent-header-${config.agentType}`}
            >
              <div className="agent-icon" style={{ backgroundColor: pipelineStep.roleBg }}>
                <Bot size={22} color={pipelineStep.roleColor} />
              </div>
              <div className="agent-info">
                <div className="agent-label-row">
                  <span className="agent-label">{pipelineStep.label}</span>
                  <span className="role-badge" style={{ backgroundColor: pipelineStep.roleBg, color: pipelineStep.roleColor }}>
                    Step {pipelineStep.step} · {pipelineStep.role}
                  </span>
                </div>
                <p className="agent-desc">{pipelineStep.description}</p>
              </div>
              <div className="agent-header-right">
                {changed && (
                  <span className="unsaved-badge" data-testid={`unsaved-${config.agentType}`}>Unsaved</span>
                )}
                {isExpanded ? (
                  <ChevronUp size={20} color="var(--color-text-muted)" />
                ) : (
                  <ChevronDown size={20} color="var(--color-text-muted)" />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="agent-body" data-testid={`agent-body-${config.agentType}`}>
                <div className="field-row">
                  <div className="field-half">
                    <label className="field-label">Model</label>
                    <input
                      className="field-input"
                      value={editModels[config.agentType] || ""}
                      onChange={(e) => handleModelChange(config.agentType, e.target.value)}
                      placeholder="gpt-5-nano"
                      data-testid={`model-input-${config.agentType}`}
                    />
                  </div>
                  <div className="field-half">
                    <label className="field-label">Max Tokens</label>
                    <input
                      className="field-input"
                      type="number"
                      value={editMaxTokens[config.agentType] || ""}
                      onChange={(e) => handleMaxTokensChange(config.agentType, e.target.value)}
                      placeholder="8192"
                      data-testid={`tokens-input-${config.agentType}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label">System Prompt</label>
                  <textarea
                    className="prompt-input"
                    value={editPrompts[config.agentType] || ""}
                    onChange={(e) => handlePromptChange(config.agentType, e.target.value)}
                    placeholder="Enter system prompt..."
                    data-testid={`prompt-input-${config.agentType}`}
                  />
                </div>

                <div className="action-row">
                  <span className="last-updated">
                    {config.id > 0
                      ? `Last updated: ${new Date(config.updatedAt).toLocaleDateString()}`
                      : "Using default prompt"}
                  </span>
                  <button
                    className="save-button"
                    onClick={() => saveMutation.mutate(config.agentType)}
                    disabled={!changed || isSaving}
                    data-testid={`save-btn-${config.agentType}`}
                  >
                    {isSaving ? (
                      <div className="spinner spinner-sm spinner-white" />
                    ) : (
                      <>
                        <Save size={16} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
