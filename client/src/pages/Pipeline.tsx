import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import "./Pipeline.css";

interface AgentDef {
  key: string;
  label: string;
  role: string;
  color: string;
  description: string;
}

const agents: AgentDef[] = [
  { key: "issues_tree", label: "Issues Tree", role: "Generator", color: "#3B82F6", description: "Builds MECE issues tree" },
  { key: "mece_critic", label: "MECE Critic", role: "Quality Gate", color: "#8B5CF6", description: "Validates MECE structure" },
  { key: "hypothesis", label: "Hypothesis", role: "Analyst", color: "#0891B2", description: "Generates hypotheses" },
  { key: "execution", label: "Execution", role: "Tool Caller", color: "#059669", description: "Runs scenario tools" },
  { key: "summary", label: "Summary", role: "Synthesizer", color: "#D97706", description: "Synthesizes findings" },
  { key: "presentation", label: "Presentation", role: "Designer", color: "#E11D48", description: "Creates final deck" },
];

const NODE_W = 180;
const NODE_H = 80;
const GAP_X = 100;
const DIAMOND_SIZE = 16;

function roleBg(color: string) {
  return color + "22";
}

function HorizontalDiagram({ onAgentClick }: { onAgentClick: (key: string) => void }) {
  const startX = 40;
  const startY = 60;
  const totalW = startX + agents.length * NODE_W + (agents.length - 1) * GAP_X + 40;
  const totalH = startY + NODE_H + 80;

  return (
    <svg className="pipeline-svg" viewBox={`0 0 ${totalW} ${totalH}`} width="100%" height="auto" style={{ minWidth: 900 }}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--color-text-muted)" />
        </marker>
        <marker id="arrowhead-purple" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#8B5CF6" />
        </marker>
      </defs>

      {agents.map((agent, i) => {
        const x = startX + i * (NODE_W + GAP_X);
        const y = startY;

        if (i < agents.length - 1) {
          const arrowStartX = x + NODE_W;
          const arrowEndX = x + NODE_W + GAP_X;
          const midY = y + NODE_H / 2;
          const diamondX = arrowStartX + GAP_X / 2;

          return (
            <g key={`conn-${i}`}>
              <line x1={arrowStartX} y1={midY} x2={diamondX - DIAMOND_SIZE - 4} y2={midY} stroke="var(--color-text-muted)" strokeWidth="1.5" />
              <g transform={`translate(${diamondX}, ${midY})`}>
                <rect x={-DIAMOND_SIZE / 2} y={-DIAMOND_SIZE / 2} width={DIAMOND_SIZE} height={DIAMOND_SIZE} rx="2" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" transform="rotate(45)" />
              </g>
              <text x={diamondX} y={midY + DIAMOND_SIZE + 12} textAnchor="middle" className="approval-label">Approval</text>
              <line x1={diamondX + DIAMOND_SIZE + 4} y1={midY} x2={arrowEndX} y2={midY} stroke="var(--color-text-muted)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            </g>
          );
        }
        return null;
      })}

      {(() => {
        const x0 = startX + NODE_W / 2;
        const x1 = startX + (NODE_W + GAP_X) + NODE_W / 2;
        const loopY = startY - 30;
        return (
          <g>
            <path
              d={`M ${x1} ${startY} C ${x1} ${loopY - 10}, ${x0} ${loopY - 10}, ${x0} ${startY}`}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="1.5"
              strokeDasharray="5,3"
              markerEnd="url(#arrowhead-purple)"
            />
            <text x={(x0 + x1) / 2} y={loopY - 14} textAnchor="middle" className="revision-label">
              Revision loop (max 2)
            </text>
          </g>
        );
      })()}

      {agents.map((agent, i) => {
        const x = startX + i * (NODE_W + GAP_X);
        const y = startY;

        return (
          <g
            key={agent.key}
            className="pipeline-agent-node"
            data-testid={`agent-node-${agent.key}`}
            onClick={() => onAgentClick(agent.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onAgentClick(agent.key); }}
          >
            <rect className="agent-node-bg" x={x} y={y} width={NODE_W} height={NODE_H} rx="10" fill="var(--color-surface)" stroke="var(--color-surface-border)" strokeWidth="1" />
            <rect x={x} y={y} width="4" height={NODE_H} rx="2" fill={agent.color} />
            <g transform={`translate(${x + 12}, ${y + 20})`}>
              <Bot size={14} color={agent.color} />
            </g>
            <text x={x + 30} y={y + 24} className="agent-node-label">{agent.label}</text>
            <rect x={x + 10} y={y + 34} width={60} height={18} rx="4" fill={roleBg(agent.color)} />
            <text x={x + 40} y={y + 46} textAnchor="middle" className="agent-node-role" fill={agent.color}>{agent.role}</text>
            <text x={x + 10} y={y + 68} className="agent-node-desc">{agent.description}</text>
          </g>
        );
      })}
    </svg>
  );
}

function VerticalDiagram({ onAgentClick }: { onAgentClick: (key: string) => void }) {
  const startX = 40;
  const startY = 40;
  const gapY = 70;
  const nodeW = 260;
  const nodeH = NODE_H;
  const totalW = startX + nodeW + 120;
  const totalH = startY + agents.length * nodeH + (agents.length - 1) * gapY + 40;

  return (
    <svg className="pipeline-svg" viewBox={`0 0 ${totalW} ${totalH}`} width="100%" height="auto">
      <defs>
        <marker id="arrowhead-v" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--color-text-muted)" />
        </marker>
        <marker id="arrowhead-purple-v" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#8B5CF6" />
        </marker>
      </defs>

      {agents.map((_, i) => {
        if (i >= agents.length - 1) return null;
        const midX = startX + nodeW / 2;
        const y1 = startY + i * (nodeH + gapY) + nodeH;
        const y2 = startY + (i + 1) * (nodeH + gapY);
        const diamondY = y1 + gapY / 2;

        return (
          <g key={`conn-v-${i}`}>
            <line x1={midX} y1={y1} x2={midX} y2={diamondY - DIAMOND_SIZE - 4} stroke="var(--color-text-muted)" strokeWidth="1.5" />
            <g transform={`translate(${midX}, ${diamondY})`}>
              <rect x={-DIAMOND_SIZE / 2} y={-DIAMOND_SIZE / 2} width={DIAMOND_SIZE} height={DIAMOND_SIZE} rx="2" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" transform="rotate(45)" />
            </g>
            <text x={midX + DIAMOND_SIZE + 8} y={diamondY + 4} className="approval-label">Approval</text>
            <line x1={midX} y1={diamondY + DIAMOND_SIZE + 4} x2={midX} y2={y2} stroke="var(--color-text-muted)" strokeWidth="1.5" markerEnd="url(#arrowhead-v)" />
          </g>
        );
      })}

      {(() => {
        const y0 = startY + nodeH / 2;
        const y1 = startY + (nodeH + gapY) + nodeH / 2;
        const loopX = startX + nodeW + 30;
        return (
          <g>
            <path
              d={`M ${startX + nodeW} ${y1} C ${loopX + 20} ${y1}, ${loopX + 20} ${y0}, ${startX + nodeW} ${y0}`}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="1.5"
              strokeDasharray="5,3"
              markerEnd="url(#arrowhead-purple-v)"
            />
            <text x={loopX + 26} y={(y0 + y1) / 2} className="revision-label" dominantBaseline="middle">
              Revision
            </text>
            <text x={loopX + 26} y={(y0 + y1) / 2 + 12} className="revision-label" dominantBaseline="middle">
              loop (max 2)
            </text>
          </g>
        );
      })()}

      {agents.map((agent, i) => {
        const x = startX;
        const y = startY + i * (nodeH + gapY);

        return (
          <g
            key={agent.key}
            className="pipeline-agent-node"
            data-testid={`agent-node-${agent.key}`}
            onClick={() => onAgentClick(agent.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onAgentClick(agent.key); }}
          >
            <rect className="agent-node-bg" x={x} y={y} width={nodeW} height={nodeH} rx="10" fill="var(--color-surface)" stroke="var(--color-surface-border)" strokeWidth="1" />
            <rect x={x} y={y} width="4" height={nodeH} rx="2" fill={agent.color} />
            <g transform={`translate(${x + 12}, ${y + 20})`}>
              <Bot size={14} color={agent.color} />
            </g>
            <text x={x + 30} y={y + 24} className="agent-node-label">{agent.label}</text>
            <rect x={x + 10} y={y + 34} width={70} height={18} rx="4" fill={roleBg(agent.color)} />
            <text x={x + 45} y={y + 46} textAnchor="middle" className="agent-node-role" fill={agent.color}>{agent.role}</text>
            <text x={x + 10} y={y + 68} className="agent-node-desc">{agent.description}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [isWide, setIsWide] = useState(window.innerWidth >= 960);

  useEffect(() => {
    const handler = () => setIsWide(window.innerWidth >= 960);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const handleAgentClick = (key: string) => {
    navigate(`/agent/${key}`);
  };

  return (
    <div className="pipeline-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pipeline Builder</h1>
          <p className="page-subtitle">Visual workflow of the AI agent pipeline</p>
        </div>
      </div>

      <div className="pipeline-diagram-container">
        {isWide ? (
          <HorizontalDiagram onAgentClick={handleAgentClick} />
        ) : (
          <VerticalDiagram onAgentClick={handleAgentClick} />
        )}
      </div>

      <div className="pipeline-legend">
        <span className="pipeline-legend-title">Legend</span>
        <div className="pipeline-legend-item">
          <div className="legend-node-sample" />
          Agent Node
        </div>
        <div className="pipeline-legend-item">
          <div className="legend-diamond" />
          Human Gate
        </div>
        <div className="pipeline-legend-item">
          <div className="legend-loop-line" />
          Revision Loop
        </div>
      </div>
    </div>
  );
}
