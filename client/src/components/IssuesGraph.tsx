import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "../lib/utils";
import { Card } from "./ui/card";

interface IssueNode {
  id: number;
  parentId: number | null;
  text: string;
  priority: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#94A3B8",
};

const LEVEL_HEIGHT = 140;
const BASE_NODE_SPACING = 200;

function IssueNodeComponent({ data }: NodeProps) {
  const color = PRIORITY_COLORS[data.priority as string] || "#94A3B8";
  const isSelected = data.isSelected as boolean;

  return (
    <div
      className={cn(
        "bg-white border-2 rounded-xl px-3.5 py-2.5 min-w-[140px] max-w-[180px] cursor-pointer transition-all hover:shadow-md",
        isSelected && "border-[2.5px]"
      )}
      style={{ borderColor: color, boxShadow: isSelected ? `0 0 0 3px ${color}30` : undefined }}
    >
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-slate-300 !border-none" />
      <div className="w-2 h-2 rounded-full mb-1.5" style={{ background: color }} />
      <div className="text-xs font-medium text-foreground leading-snug line-clamp-3 mb-1.5">
        {data.label as string}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize"
          style={{ background: color + "20", color }}
        >
          {data.priority as string}
        </span>
        {(data.childCount as number) > 0 && (
          <span className="text-[10px] text-muted-foreground">{data.childCount as number} sub</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-slate-300 !border-none" />
    </div>
  );
}

const nodeTypes = { issueNode: IssueNodeComponent };

function buildFlowData(issues: IssueNode[]) {
  const childrenMap = new Map<number, number[]>();
  issues.forEach((n) => {
    childrenMap.set(n.id, []);
  });
  const roots: number[] = [];
  issues.forEach((n) => {
    if (n.parentId && childrenMap.has(n.parentId)) {
      childrenMap.get(n.parentId)!.push(n.id);
    } else if (!n.parentId) {
      roots.push(n.id);
    }
  });

  const depthMap = new Map<number, number>();
  function setDepth(id: number, d: number) {
    depthMap.set(id, d);
    (childrenMap.get(id) || []).forEach((c) => setDepth(c, d + 1));
  }
  roots.forEach((r) => setDepth(r, 0));

  let leafIndex = 0;
  const xMap = new Map<number, number>();
  function assignX(id: number): number {
    const children = childrenMap.get(id) || [];
    if (children.length === 0) {
      const x = leafIndex * BASE_NODE_SPACING;
      leafIndex++;
      xMap.set(id, x);
      return x;
    }
    const childXs = children.map((c) => assignX(c));
    const x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    xMap.set(id, x);
    return x;
  }
  roots.forEach((r) => assignX(r));

  const issueMap = new Map(issues.map((n) => [n.id, n]));

  const nodes: Node[] = issues.map((n) => ({
    id: String(n.id),
    type: "issueNode",
    position: { x: xMap.get(n.id) || 0, y: (depthMap.get(n.id) || 0) * LEVEL_HEIGHT },
    data: {
      label: n.text,
      priority: n.priority,
      depth: depthMap.get(n.id) || 0,
      childCount: (childrenMap.get(n.id) || []).length,
      isSelected: false,
    },
  }));

  const edges: Edge[] = issues
    .filter((n) => n.parentId && issueMap.has(n.parentId))
    .map((n) => ({
      id: `e-${n.parentId}-${n.id}`,
      source: String(n.parentId),
      target: String(n.id),
      style: { stroke: "#CBD5E1", strokeWidth: 2 },
      type: "smoothstep",
    }));

  return { nodes, edges };
}

export default function IssuesGraph({ issues }: { issues: IssueNode[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { nodes: baseNodes, edges } = useMemo(() => buildFlowData(issues), [issues]);

  const nodes = useMemo(
    () =>
      baseNodes.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === selectedId },
      })),
    [baseNodes, selectedId]
  );

  const selectedIssue = useMemo(() => {
    if (!selectedId) return null;
    const issue = issues.find((i) => String(i.id) === selectedId);
    if (!issue) return null;
    const children = issues.filter((i) => i.parentId === issue.id);
    const nodeData = nodes.find((n) => n.id === selectedId)?.data as Record<string, unknown> | undefined;
    const depth = (nodeData?.depth as number) ?? 0;
    return { ...issue, depth, childCount: children.length };
  }, [selectedId, issues, nodes]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedId((prev) => (prev === node.id ? null : node.id));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIORITY_COLORS.high }} />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIORITY_COLORS.medium }} />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIORITY_COLORS.low }} />
            <span>Low</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden min-h-[300px]" style={{ height: 500 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#F1F5F9" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeWidth={3}
            nodeColor={(n) => PRIORITY_COLORS[(n.data?.priority as string)] || "#94A3B8"}
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8 }}
          />
        </ReactFlow>
      </div>

      {selectedIssue && (
        <Card className="p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="px-2 py-0.5 rounded-md text-xs font-semibold capitalize"
              style={{
                background: PRIORITY_COLORS[selectedIssue.priority] + "20",
                color: PRIORITY_COLORS[selectedIssue.priority],
              }}
            >
              {selectedIssue.priority}
            </span>
            <span className="text-xs text-muted-foreground">Level {selectedIssue.depth + 1}</span>
          </div>
          <p className="text-[15px] font-medium text-foreground leading-relaxed">{selectedIssue.text}</p>
          {selectedIssue.childCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {selectedIssue.childCount} sub-issue{selectedIssue.childCount > 1 ? "s" : ""}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
