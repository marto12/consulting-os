import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  useNodesState,
  useEdgesState,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Bot,
  Loader2,
  GitBranch,
  Pencil,
  X,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";

interface WorkflowStep {
  id?: number;
  stepOrder: number;
  name: string;
  agentKey: string;
  description: string;
}

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  version: number;
  steps: WorkflowStep[];
}

interface Agent {
  id: number;
  key: string;
  name: string;
  description: string;
  role: string;
  roleColor: string;
}

const STEP_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EF4444",
  "#14B8A6",
  "#F97316",
  "#84CC16",
];

function StepNodeComponent({ data }: NodeProps) {
  const color = data.color as string || "#6366F1";
  const isSelected = data.isSelected as boolean;

  return (
    <div
      className={cn(
        "bg-card border-2 rounded-xl px-4 py-3 min-w-[180px] max-w-[220px] cursor-pointer transition-all hover:shadow-lg",
        isSelected && "ring-2 ring-offset-2 ring-offset-background"
      )}
      style={{
        borderColor: color,
        boxShadow: isSelected ? `0 0 0 3px ${color}30` : `0 2px 8px ${color}15`,
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2 !border-border !bg-card" />
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ background: color }}
        >
          {data.stepOrder as number}
        </div>
        <span className="text-xs font-semibold text-foreground truncate flex-1">
          {data.label as string}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Bot size={12} className="text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground truncate">{data.agentKey as string}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2 !border-border !bg-card" />
    </div>
  );
}

const nodeTypes = { stepNode: StepNodeComponent };

function buildGraphData(steps: WorkflowStep[], selectedIdx: number | null) {
  const nodeSpacing = 160;
  const nodes: Node[] = steps.map((step, idx) => ({
    id: `step-${idx}`,
    type: "stepNode",
    position: { x: 300, y: idx * nodeSpacing },
    data: {
      label: step.name,
      stepOrder: step.stepOrder,
      agentKey: step.agentKey,
      color: STEP_COLORS[idx % STEP_COLORS.length],
      isSelected: idx === selectedIdx,
    },
    draggable: false,
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    edges.push({
      id: `e-${i}-${i + 1}`,
      source: `step-${i}`,
      target: `step-${i + 1}`,
      style: { stroke: "#6B7280", strokeWidth: 2 },
      type: "smoothstep",
      animated: true,
    });
  }

  return { nodes, edges };
}

function StepPanel({
  step,
  index,
  agents,
  totalSteps,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  step: WorkflowStep;
  index: number;
  agents: Agent[];
  totalSteps: number;
  onUpdate: (idx: number, updates: Partial<WorkflowStep>) => void;
  onDelete: (idx: number) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
}) {
  const color = STEP_COLORS[index % STEP_COLORS.length];

  return (
    <Card className="p-4 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: color }}
          >
            {step.stepOrder}
          </div>
          <span className="font-semibold text-foreground text-sm">Step {step.stepOrder}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            disabled={index === 0}
            onClick={() => onMoveUp(index)}
          >
            <ChevronUp size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            disabled={index === totalSteps - 1}
            onClick={() => onMoveDown(index)}
          >
            <ChevronDown size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(index)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
          <Input
            value={step.name}
            onChange={(e) => onUpdate(index, { name: e.target.value })}
            className="h-8 text-sm"
            placeholder="Step name"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent</label>
          <select
            value={step.agentKey}
            onChange={(e) => {
              const agent = agents.find((a) => a.key === e.target.value);
              onUpdate(index, {
                agentKey: e.target.value,
                name: step.name || agent?.name || e.target.value,
              });
            }}
            className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground"
          >
            <option value="">Select agent...</option>
            {agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name} ({a.key})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
          <Input
            value={step.description}
            onChange={(e) => onUpdate(index, { description: e.target.value })}
            className="h-8 text-sm"
            placeholder="Optional description"
          />
        </div>
      </div>
    </Card>
  );
}

export default function WorkflowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: workflow, isLoading: workflowLoading } = useQuery<WorkflowTemplate>({
    queryKey: [`/api/workflows/${id}`],
    enabled: !isNew,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  useEffect(() => {
    if (workflow && !initialized) {
      setName(workflow.name);
      setDescription(workflow.description);
      setSteps(
        workflow.steps.map((s) => ({
          stepOrder: s.stepOrder,
          name: s.name,
          agentKey: s.agentKey,
          description: s.description || "",
        }))
      );
      setInitialized(true);
    }
  }, [workflow, initialized]);

  useEffect(() => {
    if (isNew && !initialized) {
      setInitialized(true);
    }
  }, [isNew, initialized]);

  const { nodes: graphNodes, edges: graphEdges } = useMemo(
    () => buildGraphData(steps, selectedIdx),
    [steps, selectedIdx]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    const idx = parseInt(node.id.replace("step-", ""));
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const updateStep = useCallback((idx: number, updates: Partial<WorkflowStep>) => {
    setSteps((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
    setHasChanges(true);
  }, []);

  const deleteStep = useCallback((idx: number) => {
    setSteps((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    });
    setSelectedIdx(null);
    setHasChanges(true);
  }, []);

  const moveStep = useCallback((idx: number, direction: "up" | "down") => {
    setSteps((prev) => {
      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    });
    setSelectedIdx((prev) => {
      if (prev === null) return null;
      return direction === "up" ? prev - 1 : prev + 1;
    });
    setHasChanges(true);
  }, []);

  const addStep = useCallback(() => {
    const newStep: WorkflowStep = {
      stepOrder: steps.length + 1,
      name: `Step ${steps.length + 1}`,
      agentKey: agents[0]?.key || "project_definition",
      description: "",
    };
    setSteps((prev) => [...prev, newStep]);
    setSelectedIdx(steps.length);
    setHasChanges(true);
  }, [steps.length, agents]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, description, steps };
      if (isNew) {
        const res = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } else {
        const res = await fetch(`/api/workflows/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      if (!isNew) {
        queryClient.invalidateQueries({ queryKey: [`/api/workflows/${id}`] });
      }
      setHasChanges(false);
      if (isNew && data?.id) {
        navigate(`/workflow/${data.id}`, { replace: true });
      }
    },
  });

  if (workflowLoading && !isNew) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/workflows")}>
            <ArrowLeft size={16} className="mr-1" />
            Back
          </Button>
          <div className="w-px h-6 bg-border" />
          <GitBranch size={18} className="text-primary" />
          <div>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
              className="h-7 text-base font-semibold border-none bg-transparent p-0 focus-visible:ring-0 w-[300px]"
              placeholder="Workflow name"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/30">
              Unsaved changes
            </Badge>
          )}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
          >
            {saveMutation.isPending ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Save size={14} className="mr-1" />
            )}
            {isNew ? "Create" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <GitBranch size={48} strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-foreground">No steps yet</h3>
              <p className="text-sm">Add steps to build your workflow pipeline</p>
              <Button onClick={addStep} size="sm">
                <Plus size={14} className="mr-1" />
                Add First Step
              </Button>
            </div>
          ) : (
            <ReactFlow
              nodes={graphNodes}
              edges={graphEdges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.4 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              panOnScroll
            >
              <Background gap={20} size={1} color="hsl(var(--muted))" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}

          <div className="absolute bottom-4 left-4 z-10">
            <Button onClick={addStep} size="sm" className="shadow-lg">
              <Plus size={14} className="mr-1" />
              Add Step
            </Button>
          </div>
        </div>

        <div className="w-[360px] border-l border-border bg-card/50 overflow-y-auto p-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Workflow Details</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Input
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
                  className="h-8 text-sm"
                  placeholder="Workflow description"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{steps.length} steps</Badge>
                {!isNew && workflow && <span>v{workflow.version}</span>}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Pipeline Steps</h2>
            </div>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <StepPanel
                  key={idx}
                  step={step}
                  index={idx}
                  agents={agents}
                  totalSteps={steps.length}
                  onUpdate={updateStep}
                  onDelete={deleteStep}
                  onMoveUp={(i) => moveStep(i, "up")}
                  onMoveDown={(i) => moveStep(i, "down")}
                />
              ))}
              {steps.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={addStep}
                >
                  <Plus size={14} className="mr-1" />
                  Add Step
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
