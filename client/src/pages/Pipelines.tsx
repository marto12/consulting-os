import { useState, useCallback, useMemo, useRef } from "react";
import {
  GitBranch,
  Plus,
  Play,
  Trash2,
  Bot,
  BarChart3,
  Database,
  FileText,
  ShieldCheck,
  X,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";

interface StepDef {
  id: string;
  type: "agent" | "analysis" | "data" | "gate" | "output";
  label: string;
  description: string;
  icon: typeof Bot;
  color: string;
}

const STEP_PALETTE: StepDef[] = [
  { id: "issues_tree", type: "agent", label: "Issues Tree", description: "Build MECE issues tree", icon: Bot, color: "#3B82F6" },
  { id: "mece_critic", type: "agent", label: "MECE Critic", description: "Validate structure", icon: Bot, color: "#8B5CF6" },
  { id: "hypothesis", type: "agent", label: "Hypothesis", description: "Generate hypotheses", icon: Bot, color: "#0891B2" },
  { id: "execution", type: "agent", label: "Execution", description: "Run scenario tools", icon: Bot, color: "#059669" },
  { id: "summary", type: "agent", label: "Summary", description: "Synthesize findings", icon: Bot, color: "#D97706" },
  { id: "presentation", type: "agent", label: "Presentation", description: "Create final deck", icon: Bot, color: "#E11D48" },
  { id: "regression", type: "analysis", label: "Regression", description: "Statistical regression", icon: BarChart3, color: "#6366F1" },
  { id: "clustering", type: "analysis", label: "Clustering", description: "Segment analysis", icon: BarChart3, color: "#EC4899" },
  { id: "sentiment", type: "analysis", label: "Sentiment", description: "Text sentiment scoring", icon: BarChart3, color: "#14B8A6" },
  { id: "forecasting", type: "analysis", label: "Forecasting", description: "Time series prediction", icon: BarChart3, color: "#F97316" },
  { id: "data_source", type: "data", label: "Data Source", description: "Connect a dataset", icon: Database, color: "#64748B" },
  { id: "approval_gate", type: "gate", label: "Approval Gate", description: "Human review step", icon: ShieldCheck, color: "#D97706" },
  { id: "report", type: "output", label: "Report Output", description: "Generate final report", icon: FileText, color: "#10B981" },
];

interface PipelineDef {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  status: "draft" | "active" | "completed";
  lastRun: string;
  nodes: Node[];
  edges: Edge[];
}

function buildSamplePipelines(): PipelineDef[] {
  return [
    {
      id: "p1",
      name: "Full Consulting Workflow",
      description: "End-to-end strategy engagement: issues tree through final presentation with human approval gates",
      stepCount: 9,
      status: "active",
      lastRun: "2 hours ago",
      nodes: [
        { id: "n1", type: "pipelineStep", position: { x: 0, y: 100 }, data: { step: STEP_PALETTE[10], instanceId: "n1" } },
        { id: "n2", type: "pipelineStep", position: { x: 220, y: 100 }, data: { step: STEP_PALETTE[0], instanceId: "n2" } },
        { id: "n3", type: "pipelineGate", position: { x: 440, y: 115 }, data: { label: "Review" } },
        { id: "n4", type: "pipelineStep", position: { x: 560, y: 100 }, data: { step: STEP_PALETTE[1], instanceId: "n4" } },
        { id: "n5", type: "pipelineStep", position: { x: 780, y: 100 }, data: { step: STEP_PALETTE[2], instanceId: "n5" } },
        { id: "n6", type: "pipelineGate", position: { x: 1000, y: 115 }, data: { label: "Approve" } },
        { id: "n7", type: "pipelineStep", position: { x: 1120, y: 100 }, data: { step: STEP_PALETTE[3], instanceId: "n7" } },
        { id: "n8", type: "pipelineStep", position: { x: 1340, y: 100 }, data: { step: STEP_PALETTE[4], instanceId: "n8" } },
        { id: "n9", type: "pipelineStep", position: { x: 1560, y: 100 }, data: { step: STEP_PALETTE[5], instanceId: "n9" } },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "e2", source: "n2", target: "n3", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "e3", source: "n3", target: "n4", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "e4", source: "n4", target: "n5", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "e5", source: "n5", target: "n6", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "e6", source: "n6", target: "n7", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "e7", source: "n7", target: "n8", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "e8", source: "n8", target: "n9", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
      ],
    },
    {
      id: "p2",
      name: "Market Analysis Pipeline",
      description: "Automated market research with clustering, sentiment analysis, and regression modeling",
      stepCount: 6,
      status: "completed",
      lastRun: "1 day ago",
      nodes: [
        { id: "m1", type: "pipelineStep", position: { x: 0, y: 100 }, data: { step: STEP_PALETTE[10], instanceId: "m1" } },
        { id: "m2", type: "pipelineStep", position: { x: 220, y: 40 }, data: { step: STEP_PALETTE[8], instanceId: "m2" } },
        { id: "m3", type: "pipelineStep", position: { x: 220, y: 160 }, data: { step: STEP_PALETTE[7], instanceId: "m3" } },
        { id: "m4", type: "pipelineStep", position: { x: 440, y: 100 }, data: { step: STEP_PALETTE[6], instanceId: "m4" } },
        { id: "m5", type: "pipelineGate", position: { x: 660, y: 115 }, data: { label: "Review" } },
        { id: "m6", type: "pipelineStep", position: { x: 780, y: 100 }, data: { step: STEP_PALETTE[12], instanceId: "m6" } },
      ],
      edges: [
        { id: "me1", source: "m1", target: "m2", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "me2", source: "m1", target: "m3", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "me3", source: "m2", target: "m4", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "me4", source: "m3", target: "m4", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "me5", source: "m4", target: "m5", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "me6", source: "m5", target: "m6", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
      ],
    },
    {
      id: "p3",
      name: "Financial Forecast Pipeline",
      description: "Time-series forecasting with scenario modeling and executive summary generation",
      stepCount: 5,
      status: "draft",
      lastRun: "Never",
      nodes: [
        { id: "f1", type: "pipelineStep", position: { x: 0, y: 100 }, data: { step: STEP_PALETTE[10], instanceId: "f1" } },
        { id: "f2", type: "pipelineStep", position: { x: 220, y: 100 }, data: { step: STEP_PALETTE[9], instanceId: "f2" } },
        { id: "f3", type: "pipelineStep", position: { x: 440, y: 100 }, data: { step: STEP_PALETTE[3], instanceId: "f3" } },
        { id: "f4", type: "pipelineGate", position: { x: 660, y: 115 }, data: { label: "Approve" } },
        { id: "f5", type: "pipelineStep", position: { x: 780, y: 100 }, data: { step: STEP_PALETTE[4], instanceId: "f5" } },
      ],
      edges: [
        { id: "fe1", source: "f1", target: "f2", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "fe2", source: "f2", target: "f3", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "fe3", source: "f3", target: "f4", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
        { id: "fe4", source: "f4", target: "f5", type: "smoothstep", style: { stroke: "#94A3B8", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" } },
      ],
    },
  ];
}

function PipelineStepNode({ data }: NodeProps) {
  const step = data.step as StepDef;
  const Icon = step.icon;
  const isAnalysis = step.type === "analysis";
  const isData = step.type === "data";
  const isOutput = step.type === "output";
  return (
    <div className="bg-white rounded-lg shadow-sm border border-border overflow-hidden w-[180px] cursor-pointer hover:shadow-md transition-shadow">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border !border-border" />
      <div className="h-1 w-full" style={{ background: step.color }} />
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon size={14} color={step.color} />
          <span className="text-xs font-semibold text-foreground">{step.label}</span>
        </div>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mb-1"
          style={{ background: step.color + "15", color: step.color }}
        >
          {isAnalysis ? "Analysis" : isData ? "Data" : isOutput ? "Output" : step.type === "agent" ? "Agent" : "Gate"}
        </span>
        <span className="text-[10px] text-muted-foreground block">{step.description}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border !border-border" />
    </div>
  );
}

function PipelineGateNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border !border-border" />
      <div className="w-6 h-6 rounded-sm rotate-45 flex items-center justify-center bg-amber-50 border border-amber-200">
        <ShieldCheck size={11} color="#D97706" className="-rotate-45" />
      </div>
      <span className="text-[10px] font-medium text-amber-600 mt-1">{data.label as string}</span>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border !border-border" />
    </div>
  );
}

const pipelineNodeTypes = {
  pipelineStep: PipelineStepNode,
  pipelineGate: PipelineGateNode,
};

function PipelineCard({
  pipeline,
  onOpen,
}: {
  pipeline: PipelineDef;
  onOpen: () => void;
}) {
  const statusConfig = {
    draft: { label: "Draft", variant: "secondary" as const },
    active: { label: "Active", variant: "success" as const },
    completed: { label: "Completed", variant: "default" as const },
  };
  const s = statusConfig[pipeline.status];

  return (
    <Card className="cursor-pointer hover:shadow-md transition-all" onClick={onOpen}>
      <div className="flex items-start gap-3 p-5">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <GitBranch size={18} color="#6366F1" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{pipeline.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{pipeline.description}</p>
        </div>
        <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-1" />
      </div>
      <div className="flex items-center gap-3 px-5 pb-4">
        <Badge variant={s.variant}>
          {pipeline.status === "active" && <Play size={10} className="mr-1" />}
          {pipeline.status === "completed" && <CheckCircle2 size={10} className="mr-1" />}
          {pipeline.status === "draft" && <Clock size={10} className="mr-1" />}
          {s.label}
        </Badge>
        <span className="text-xs text-muted-foreground">{pipeline.stepCount} steps</span>
        <span className="text-xs text-muted-foreground">{pipeline.lastRun === "Never" ? "Not run yet" : `Last run ${pipeline.lastRun}`}</span>
      </div>
    </Card>
  );
}

function PipelineBuilder({
  pipeline,
  onClose,
}: {
  pipeline: PipelineDef;
  onClose: () => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(pipeline.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(pipeline.edges);
  const nodeIdCounter = useRef(100);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            style: { stroke: "#94A3B8", strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  function addStep(stepDef: StepDef) {
    const id = `new-${nodeIdCounter.current++}`;
    const maxX = nodes.reduce((mx, n) => Math.max(mx, n.position.x), 0);
    const newNode: Node = {
      id,
      type: stepDef.type === "gate" ? "pipelineGate" : "pipelineStep",
      position: { x: maxX + 240, y: 100 },
      data:
        stepDef.type === "gate"
          ? { label: "Approve" }
          : { step: stepDef, instanceId: id },
    };
    setNodes((nds) => [...nds, newNode]);
  }

  function deleteSelected() {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => {
      const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      return eds.filter(
        (e) => !e.selected && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
      );
    });
  }

  const statusConfig = {
    draft: { label: "Draft", variant: "secondary" as const },
    active: { label: "Active", variant: "success" as const },
    completed: { label: "Completed", variant: "default" as const },
  };
  const s = statusConfig[pipeline.status];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-[95%] max-w-7xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <GitBranch size={18} color="#6366F1" />
            </div>
            <div>
              <h2 className="font-semibold text-base">{pipeline.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={s.variant}>{s.label}</Badge>
                <span className="text-xs text-muted-foreground">{nodes.length} steps</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={deleteSelected}>
              <Trash2 size={14} />
              Delete
            </Button>
            <Button size="sm">
              <Play size={14} />
              Run
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[200px] border-r border-border overflow-y-auto p-3">
            <div className="mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agents</span>
              <div className="mt-2 flex flex-col gap-0.5">
                {STEP_PALETTE.filter((s) => s.type === "agent").map((step) => (
                  <button
                    key={step.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted transition-colors w-full group"
                    onClick={() => addStep(step)}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: step.color }} />
                    <span className="flex-1">{step.label}</span>
                    <Plus size={12} className="opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analysis</span>
              <div className="mt-2 flex flex-col gap-0.5">
                {STEP_PALETTE.filter((s) => s.type === "analysis").map((step) => (
                  <button
                    key={step.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted transition-colors w-full group"
                    onClick={() => addStep(step)}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: step.color }} />
                    <span className="flex-1">{step.label}</span>
                    <Plus size={12} className="opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Controls</span>
              <div className="mt-2 flex flex-col gap-0.5">
                {STEP_PALETTE.filter((s) => s.type === "data" || s.type === "gate" || s.type === "output").map((step) => (
                  <button
                    key={step.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted transition-colors w-full group"
                    onClick={() => addStep(step)}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: step.color }} />
                    <span className="flex-1">{step.label}</span>
                    <Plus size={12} className="opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={pipelineNodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              deleteKeyCode={["Backspace", "Delete"]}
              snapToGrid
              snapGrid={[20, 20]}
            >
              <Background gap={20} size={1} color="#E2E8F0" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Pipelines() {
  const [activePipeline, setActivePipeline] = useState<PipelineDef | null>(null);
  const pipelines = useMemo(() => buildSamplePipelines(), []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pipelines</h1>
          <p className="text-sm text-muted-foreground mt-1">Link agents and analysis steps into automated workflows</p>
        </div>
        <Button disabled>
          <Plus size={16} />
          New Pipeline
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {pipelines.map((p) => (
          <PipelineCard key={p.id} pipeline={p} onOpen={() => setActivePipeline(p)} />
        ))}
      </div>

      {activePipeline && (
        <PipelineBuilder pipeline={activePipeline} onClose={() => setActivePipeline(null)} />
      )}
    </div>
  );
}
