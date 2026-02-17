import { useNavigate } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { Bot, ShieldCheck } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";

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

function AgentNodeComponent({ data }: NodeProps) {
  const agent = data.agent as AgentDef;
  return (
    <div className="bg-white rounded-lg shadow-sm border border-border overflow-hidden w-[180px] cursor-pointer hover:shadow-md transition-shadow" data-testid={`agent-node-${agent.key}`}>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border !border-border" />
      <div className="h-1 w-full" style={{ background: agent.color }} />
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Bot size={14} color={agent.color} />
          <span className="text-xs font-semibold text-foreground">{agent.label}</span>
        </div>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mb-1"
          style={{ background: agent.color + "18", color: agent.color }}
        >
          {agent.role}
        </span>
        <span className="text-[10px] text-muted-foreground block">{agent.description}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border !border-border" />
    </div>
  );
}

function GateNodeComponent({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border !border-border" />
      <div className="w-6 h-6 rounded-sm rotate-45 flex items-center justify-center bg-amber-50 border border-amber-200">
        <ShieldCheck size={12} color="#D97706" className="-rotate-45" />
      </div>
      <span className="text-[10px] font-medium text-amber-600 mt-1">{data.label as string}</span>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border !border-border" />
    </div>
  );
}

function RevisionNodeComponent({ data }: NodeProps) {
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-full px-3 py-1">
      <Handle type="target" position={Position.Right} className="!w-2 !h-2 !bg-border !border-border" />
      <span className="text-[10px] font-medium text-violet-600">{data.label as string}</span>
      <Handle type="source" position={Position.Left} className="!w-2 !h-2 !bg-border !border-border" />
    </div>
  );
}

const nodeTypes = {
  agentNode: AgentNodeComponent,
  gateNode: GateNodeComponent,
  revisionNode: RevisionNodeComponent,
};

const NODE_W = 200;
const GATE_W = 80;
const GAP = 60;

function buildPipelineFlow(onAgentClick: (key: string) => void) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  agents.forEach((agent, i) => {
    const x = i * (NODE_W + GATE_W + GAP * 2);
    nodes.push({
      id: `agent-${agent.key}`,
      type: "agentNode",
      position: { x, y: 80 },
      data: { agent, onClick: onAgentClick },
    });

    if (i < agents.length - 1) {
      const gateX = x + NODE_W + GAP;
      nodes.push({
        id: `gate-${i}`,
        type: "gateNode",
        position: { x: gateX, y: 95 },
        data: { label: "Approve" },
      });

      edges.push({
        id: `e-agent-${i}-to-gate`,
        source: `agent-${agent.key}`,
        target: `gate-${i}`,
        type: "smoothstep",
        style: { stroke: "#CBD5E1", strokeWidth: 1.5 },
        animated: false,
      });
      edges.push({
        id: `e-gate-to-agent-${i + 1}`,
        source: `gate-${i}`,
        target: `agent-${agents[i + 1].key}`,
        type: "smoothstep",
        style: { stroke: "#CBD5E1", strokeWidth: 1.5 },
        animated: false,
      });
    }
  });

  const revisionX = (NODE_W + GATE_W + GAP * 2) * 0.5;
  nodes.push({
    id: "revision-loop",
    type: "revisionNode",
    position: { x: revisionX, y: 0 },
    data: { label: "Revision loop (max 2)" },
  });

  edges.push({
    id: "e-critic-to-revision",
    source: `agent-${agents[1].key}`,
    target: "revision-loop",
    type: "smoothstep",
    style: { stroke: "#8B5CF6", strokeWidth: 1.5, strokeDasharray: "5,3" },
    animated: true,
  });
  edges.push({
    id: "e-revision-to-issues",
    source: "revision-loop",
    target: `agent-${agents[0].key}`,
    type: "smoothstep",
    style: { stroke: "#8B5CF6", strokeWidth: 1.5, strokeDasharray: "5,3" },
    animated: true,
  });

  return { nodes, edges };
}

export default function Pipeline() {
  const navigate = useNavigate();

  const handleAgentClick = useCallback(
    (key: string) => {
      navigate(`/agent/${key}`);
    },
    [navigate]
  );

  const { nodes, edges } = useMemo(
    () => buildPipelineFlow(handleAgentClick),
    [handleAgentClick]
  );

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      if (node.id.startsWith("agent-")) {
        const key = node.id.replace("agent-", "");
        handleAgentClick(key);
      }
    },
    [handleAgentClick]
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Visual workflow of the AI agent pipeline</p>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-white" style={{ height: 320 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
        >
          <Background gap={20} size={1} color="#F1F5F9" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="flex items-center gap-6 mt-4 px-1">
        <span className="text-xs font-semibold text-muted-foreground">Legend</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-4 h-3 rounded-sm border border-border bg-white" />
          Agent Node
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-sm rotate-45 bg-amber-50 border border-amber-200" />
          Human Gate
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-4 h-0.5 bg-violet-400" style={{ borderTop: "1.5px dashed #8B5CF6" }} />
          Revision Loop
        </div>
      </div>
    </div>
  );
}
