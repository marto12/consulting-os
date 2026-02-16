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
import "./AgentDetail.css";

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
      <div className="agent-detail">
        <div className="loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="agent-detail">
        <div className="error-state">
          <AlertCircle size={40} color="var(--color-error)" />
          <h3>Agent not found</h3>
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const promptLines = agent.systemPrompt.split("\n").length;

  return (
    <div className="agent-detail">
      <div className="ad-top-bar">
        <button className="ad-back-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div className="ad-top-bar-center">
          <Bot size={18} color={agent.roleColor} />
          <span className="ad-top-bar-title">{agent.label}</span>
        </div>
        <div className="ad-top-bar-spacer" />
      </div>

      <div className="ad-scroll-content">
        <div className="ad-hero-card">
          <div className="ad-hero-accent" style={{ backgroundColor: agent.roleColor }} />
          <div className="ad-hero-body">
            <div className="ad-hero-top-row">
              <div className="ad-role-badge" style={{ backgroundColor: agent.roleBg, color: agent.roleColor }}>
                {agent.role}
              </div>
              <div className="ad-hero-meta">
                <div className="ad-hero-meta-label">Stage</div>
                <div className="ad-hero-meta-value">{formatStage(agent.stage)}</div>
              </div>
            </div>
            <div className="ad-hero-title-row">
              <Bot size={26} color={agent.roleColor} />
              <span className="ad-hero-title">{agent.label} Agent</span>
            </div>
            <div className="ad-hero-desc">{agent.description}</div>
          </div>
        </div>

        <div className="ad-pill-row">
          <div className="ad-info-pill">
            <div className="ad-info-pill-label">Model</div>
            <div className="ad-info-pill-value" style={{ color: "var(--color-accent)" }}>{agent.model}</div>
          </div>
          <div className="ad-info-pill">
            <div className="ad-info-pill-label">Max Tokens</div>
            <div className="ad-info-pill-value">{agent.maxTokens.toLocaleString()}</div>
          </div>
          <div className="ad-info-pill">
            <div className="ad-info-pill-label">Trigger</div>
            <div className="ad-info-pill-value" style={{ color: "var(--color-success)" }}>{formatStage(agent.triggerStage)}</div>
          </div>
          <div className="ad-info-pill">
            <div className="ad-info-pill-label">Produces</div>
            <div className="ad-info-pill-value" style={{ color: "var(--color-warning)" }}>{formatStage(agent.producesStage)}</div>
          </div>
        </div>

        <div className="ad-section-header">
          <LogIn size={16} />
          <span className="ad-section-title">Inputs</span>
        </div>
        {agent.inputs.map((field) => (
          <div key={field.name} className="ad-field-card">
            <div className="ad-field-name-row">
              <span className="ad-field-name">{field.name}</span>
              <span className="ad-type-badge">{field.type}</span>
            </div>
            <div className="ad-field-desc">{field.description}</div>
          </div>
        ))}

        <div className="ad-section-header">
          <LogOut size={16} />
          <span className="ad-section-title">Outputs</span>
        </div>
        {agent.outputs.map((field) => (
          <div key={field.name} className="ad-field-card">
            <div className="ad-field-name-row">
              <span className="ad-field-name">{field.name}</span>
              <span className="ad-type-badge">{field.type}</span>
            </div>
            <div className="ad-field-desc">{field.description}</div>
          </div>
        ))}

        <div className="ad-section-header">
          <Code size={16} />
          <span className="ad-section-title">Output Schema</span>
        </div>
        <div className="ad-code-block">
          <pre className="ad-code-text">{agent.outputSchema}</pre>
        </div>

        {agent.tools.length > 0 && (
          <>
            <div className="ad-section-header">
              <Wrench size={16} />
              <span className="ad-section-title">Tools</span>
            </div>
            {agent.tools.map((tool) => (
              <div key={tool.name} className="ad-tool-card">
                <div className="ad-tool-header">
                  <Wrench size={16} color="var(--color-success)" />
                  <span className="ad-tool-name">{tool.name}</span>
                </div>
                <div className="ad-tool-desc">{tool.description}</div>
                {Object.keys(tool.parameters).length > 0 && (
                  <div className="ad-tool-params">
                    <div className="ad-tool-params-title">Parameters</div>
                    {Object.entries(tool.parameters).map(([param, desc]) => (
                      <div key={param} className="ad-tool-param-row">
                        <div className="ad-tool-param-name">{param}</div>
                        <div className="ad-tool-param-desc">{desc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        <div className="ad-section-header">
          <Terminal size={16} />
          <span className="ad-section-title">System Prompt</span>
        </div>
        <div className="ad-prompt-card">
          <div className="ad-prompt-meta">
            {promptLines} lines | {agent.systemPrompt.length} chars
          </div>
          <div className="ad-prompt-scroll">
            <pre className="ad-prompt-text">{agent.systemPrompt}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
