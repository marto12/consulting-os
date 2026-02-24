import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import yaml from "js-yaml";
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
  Upload,
  Download,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

interface WorkflowStep {
  id?: number;
  stepOrder: number;
  name: string;
  agentKey: string;
  description: string;
  parallelGroup?: number;
  configJson?: any;
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
  const parallelGroup = data.parallelGroup as number | undefined;

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
        {parallelGroup && parallelGroup > 0 && (
          <Badge variant="secondary" className="text-[10px]">P{parallelGroup}</Badge>
        )}
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
  const rowSpacing = 170;
  const colSpacing = 220;

  const groups = new Map<string, { key: string; order: number; steps: { step: WorkflowStep; index: number }[] }>();
  steps.forEach((step, index) => {
    const groupId = step.parallelGroup && step.parallelGroup > 0
      ? `p-${step.parallelGroup}`
      : `s-${step.stepOrder}`;
    if (!groups.has(groupId)) {
      groups.set(groupId, { key: groupId, order: step.stepOrder, steps: [] });
    }
    groups.get(groupId)?.steps.push({ step, index });
  });

  const orderedGroups = Array.from(groups.values()).sort((a, b) => a.order - b.order);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  orderedGroups.forEach((group, rowIdx) => {
    const offsetX = -((group.steps.length - 1) * colSpacing) / 2;
    group.steps.forEach((entry, colIdx) => {
      const { step, index } = entry;
      nodes.push({
        id: `step-${index}`,
        type: "stepNode",
        position: { x: 300 + offsetX + colIdx * colSpacing, y: rowIdx * rowSpacing },
        data: {
          label: step.name,
          stepOrder: step.stepOrder,
          agentKey: step.agentKey,
          color: STEP_COLORS[index % STEP_COLORS.length],
          isSelected: index === selectedIdx,
          parallelGroup: step.parallelGroup || 0,
        },
        draggable: false,
      });
    });

    if (rowIdx > 0) {
      const prevGroup = orderedGroups[rowIdx - 1];
      prevGroup.steps.forEach((prev) => {
        group.steps.forEach((current) => {
          edges.push({
            id: `e-${prev.index}-${current.index}`,
            source: `step-${prev.index}`,
            target: `step-${current.index}`,
            style: { stroke: "#6B7280", strokeWidth: 2 },
            type: "smoothstep",
            animated: true,
          });
        });
      });
    }
  });

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
  parallelGroupOptions,
}: {
  step: WorkflowStep;
  index: number;
  agents: Agent[];
  totalSteps: number;
  onUpdate: (idx: number, updates: Partial<WorkflowStep>) => void;
  onDelete: (idx: number) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  parallelGroupOptions: number[];
}) {
  const color = STEP_COLORS[index % STEP_COLORS.length];
  const configPreview = useMemo(
    () => ({ ...(step.configJson || {}), parallelGroup: step.parallelGroup || 0 }),
    [step.configJson, step.parallelGroup]
  );
  const configText = useMemo(() => JSON.stringify(configPreview, null, 2), [configPreview]);

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
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Parallel group</label>
          <select
            value={step.parallelGroup || 0}
            onChange={(e) => onUpdate(index, { parallelGroup: Number(e.target.value) })}
            className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground"
          >
            <option value={0}>Sequential</option>
            {parallelGroupOptions.map((group) => (
              <option key={group} value={group}>Group {group}</option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Steps in the same group run in parallel.
          </div>
        </div>

        {step.agentKey === "model_runner" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Model name</label>
            <Input
              value={step.configJson?.modelName || ""}
              onChange={(e) =>
                onUpdate(index, {
                  configJson: {
                    ...(step.configJson || {}),
                    modelName: e.target.value,
                  },
                })
              }
              className="h-8 text-sm"
              placeholder="CGE Economic Model"
            />
            <div className="mt-1 text-[11px] text-muted-foreground">
              Matches against project model names when running.
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Step config</label>
          <pre className="text-xs bg-muted/40 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
            {configText}
          </pre>
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importedWorkflowId, setImportedWorkflowId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        workflow.steps.map((s: any) => ({
          stepOrder: s.stepOrder,
          name: s.name,
          agentKey: s.agentKey,
          description: s.description || "",
          parallelGroup: s.configJson?.parallelGroup ?? 0,
          configJson: s.configJson || {},
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

  const parallelGroupOptions = useMemo(() => {
    const existing = steps.map((step) => step.parallelGroup || 0).filter((group) => group > 0);
    const maxGroup = existing.length > 0 ? Math.max(...existing) : 0;
    const count = Math.max(3, maxGroup + 1);
    return Array.from({ length: count }, (_, idx) => idx + 1);
  }, [steps]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const idx = parseInt(node.id.replace("step-", ""));
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const parseLangGraphYaml = useCallback((input: string) => {
    const data: { name?: string; description?: string; nodes: any[]; edges: any[] } = {
      nodes: [],
      edges: [],
    };
    const lines = input.split(/\r?\n/);
    let section: "nodes" | "edges" | null = null;
    let currentItem: any = null;

    const setValue = (obj: any, key: string, rawValue: string) => {
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      obj[key] = value;
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      if (trimmed.startsWith("name:")) {
        data.name = trimmed.replace(/^name:\s*/, "");
        return;
      }
      if (trimmed.startsWith("description:")) {
        data.description = trimmed.replace(/^description:\s*/, "");
        return;
      }
      if (trimmed.startsWith("nodes:")) {
        section = "nodes";
        currentItem = null;
        return;
      }
      if (trimmed.startsWith("edges:")) {
        section = "edges";
        currentItem = null;
        return;
      }

      if (section && trimmed.startsWith("-")) {
        currentItem = {};
        data[section].push(currentItem);
        const inline = trimmed.replace(/^\-\s*/, "");
        if (inline.includes(":")) {
          const [key, ...rest] = inline.split(":");
          setValue(currentItem, key.trim(), rest.join(":").trim());
        }
        return;
      }

      if (section && currentItem && trimmed.includes(":")) {
        const [key, ...rest] = trimmed.split(":");
        setValue(currentItem, key.trim(), rest.join(":").trim());
      }
    });

    if (!data.nodes.length) {
      throw new Error("No nodes found. Add a nodes: list with id/name/agent.");
    }

    const nodeMap = new Map<string, any>();
    data.nodes.forEach((node) => {
      if (!node.id) return;
      nodeMap.set(String(node.id), node);
    });

    const indegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    nodeMap.forEach((_value, key) => {
      indegree.set(key, 0);
      adjacency.set(key, []);
    });

    data.edges.forEach((edge) => {
      const from = edge.from || edge.source;
      const to = edge.to || edge.target;
      if (!from || !to) return;
      if (!adjacency.has(from) || !indegree.has(to)) return;
      adjacency.get(from)?.push(to);
      indegree.set(to, (indegree.get(to) || 0) + 1);
    });

    const queue: string[] = [];
    indegree.forEach((value, key) => {
      if (value === 0) queue.push(key);
    });

    const orderedIds: string[] = [];
    while (queue.length) {
      const id = queue.shift();
      if (!id) continue;
      orderedIds.push(id);
      adjacency.get(id)?.forEach((next) => {
        indegree.set(next, (indegree.get(next) || 0) - 1);
        if (indegree.get(next) === 0) queue.push(next);
      });
    }

    if (orderedIds.length === 0) {
      orderedIds.push(...Array.from(nodeMap.keys()));
    }

    const steps: WorkflowStep[] = orderedIds.map((nodeId, idx) => {
      const node = nodeMap.get(nodeId) || {};
      return {
        stepOrder: idx + 1,
        name: node.name || nodeId,
        agentKey: node.agent || node.agentKey || "general",
        description: node.description || "",
      };
    });

    return { name: data.name, description: data.description, steps };
  }, []);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const spec = yaml.load(text) as any;
      if (!spec || typeof spec !== "object") {
        throw new Error("Invalid YAML file.");
      }
      if (spec.kind !== "langchain_workflow") {
        throw new Error("Unsupported spec kind. Expected langchain_workflow.");
      }

      const workflow = spec.workflow || {};
      const runtimeDefaults = spec.runtime?.model_defaults || {};
      const agentDefs = spec.agents || {};
      const nodes = spec.nodes || {};
      const edges = spec.edges || {};

      const agentsToCreate: Record<string, any> = {};

      Object.entries(agentDefs).forEach(([key, agent]: any) => {
        const model = agent.model?.model || runtimeDefaults.model || "gpt-5";
        const temperature = agent.model?.temperature ?? runtimeDefaults.temperature ?? 0.2;
        const maxTokens = agent.model?.max_tokens ?? runtimeDefaults.max_tokens ?? 1800;
        agentsToCreate[key] = {
          key,
          name: key.replace(/_/g, " "),
          description: agent.description || agent.system_prompt || "Imported agent",
          role: key,
          roleColor: "#3B82F6",
          promptTemplate: agent.system_prompt || "",
          model,
          maxTokens,
          inputSchema: agent.input_schema || null,
          outputSchema: agent.output_schema || null,
          toolRefs: agent.tool_pack_ref ? [agent.tool_pack_ref] : [],
        };
      });

      const sequence = edges.sequence || [];
      const orderedNodeIds: string[] = [];
      sequence.forEach((edge: any) => {
        if (edge.from && !orderedNodeIds.includes(edge.from)) orderedNodeIds.push(edge.from);
        if (edge.to && !orderedNodeIds.includes(edge.to)) orderedNodeIds.push(edge.to);
      });
      if (orderedNodeIds.length === 0) {
        orderedNodeIds.push(...Object.keys(nodes));
      }

      const steps: WorkflowStep[] = orderedNodeIds.map((nodeId, idx) => {
        const node = nodes[nodeId] || {};
        let agentKey = "general";
        if (node.type === "agent" && node.agent_ref) {
          agentKey = String(node.agent_ref).split(".").pop() || node.agent_ref;
        } else if (node.type === "map" && node.child?.agent_ref) {
          agentKey = String(node.child.agent_ref).split(".").pop() || node.child.agent_ref;
        } else if (node.type?.startsWith("llm")) {
          agentKey = `chain_${nodeId}`;
          if (!agentsToCreate[agentKey]) {
            agentsToCreate[agentKey] = {
              key: agentKey,
              name: nodeId.replace(/_/g, " "),
              description: node.prompt || "LLM chain node",
              role: "LLM Chain",
              roleColor: "#8B5CF6",
              promptTemplate: node.prompt || "",
              model: runtimeDefaults.model || "gpt-5",
              maxTokens: runtimeDefaults.max_tokens || 1800,
            };
          }
        } else if (node.type === "human_gate") {
          agentKey = "human_gate";
          if (!agentsToCreate[agentKey]) {
            agentsToCreate[agentKey] = {
              key: agentKey,
              name: "Human gate",
              description: node.instructions || "Human review gate",
              role: "Human",
              roleColor: "#F59E0B",
              promptTemplate: node.instructions || "",
              model: runtimeDefaults.model || "gpt-5",
              maxTokens: runtimeDefaults.max_tokens || 1800,
            };
          }
        }

        return {
          stepOrder: idx + 1,
          name: node.name || nodeId,
          agentKey,
          description: node.description || node.prompt || "",
        };
      });

      await Promise.all(
        Object.values(agentsToCreate).map((agent: any) =>
          fetch(`/api/agents/${agent.key}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(agent),
          })
        )
      );

      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflow.name || "Imported workflow",
          description: workflow.description || "",
          steps: steps.map((step, index) => ({
            stepOrder: step.stepOrder || index + 1,
            name: step.name,
            agentKey: step.agentKey,
            description: step.description || "",
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      if (data?.id) {
        setImportedWorkflowId(data.id);
        if (data.name) setName(data.name);
        if (data.description) setDescription(data.description);
        if (Array.isArray(data.steps)) {
          setSteps(
            data.steps.map((s: any) => ({
              stepOrder: s.stepOrder,
              name: s.name,
              agentKey: s.agentKey,
              description: s.description || "",
              parallelGroup: s.configJson?.parallelGroup ?? 0,
            }))
          );
        }
        setSelectedIdx(null);
        setHasChanges(false);
        setInitialized(true);
      }
    },
    onError: (err: any) => {
      setUploadError(err?.message || "Failed to import workflow file.");
    },
  });

  const templateYaml = useMemo(() => (
    `name: CGE Workflow\n` +
    `description: Simple LangGraph workflow\n` +
    `nodes:\n` +
    `  - id: define\n` +
    `    name: Project Definition\n` +
    `    agent: project_definition\n` +
    `  - id: issues\n` +
    `    name: Issues Tree\n` +
    `    agent: issues_tree\n` +
    `edges:\n` +
    `  - from: define\n` +
    `    to: issues\n`
  ), []);

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([templateYaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "langgraph-workflow-template.yaml";
    link.click();
    URL.revokeObjectURL(url);
  }, [templateYaml]);

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
      parallelGroup: 0,
      configJson: {},
    };
    setSteps((prev) => [...prev, newStep]);
    setSelectedIdx(steps.length);
    setHasChanges(true);
  }, [steps.length, agents]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        description,
        steps: steps.map((step) => ({
          ...step,
          configJson: { ...(step.configJson || {}), parallelGroup: step.parallelGroup || 0 },
        })),
      };
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
        navigate(`/global/workflow/${data.id}`, { replace: true });
      }
    },
  });

  if (workflowLoading && !isNew) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
          <div className="w-80 border-l p-6">
            <Skeleton className="h-4 w-32 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/global/workflows")}>
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
            <Badge variant="outline" className="text-muted-foreground border-border">
              Unsaved changes
            </Badge>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploadError(null);
              importMutation.mutate(file);
              event.currentTarget.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            <Upload size={14} className="mr-1" />
            {importMutation.isPending ? "Importing..." : "Upload YAML"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadTemplate}
          >
            <Download size={14} className="mr-1" />
            Download Template
          </Button>
          {importedWorkflowId && isNew ? (
            <Button
              size="sm"
              onClick={() => navigate(`/global/workflow/${importedWorkflowId}`)}
            >
              Open workflow
            </Button>
          ) : (
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
          )}
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
                  parallelGroupOptions={parallelGroupOptions}
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
