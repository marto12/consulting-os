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
import "./IssuesGraph.css";

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
      className={`rf-issue-node${isSelected ? " selected" : ""}`}
      style={{ borderColor: color, boxShadow: isSelected ? `0 0 0 3px ${color}30` : undefined }}
    >
      <Handle type="target" position={Position.Top} className="rf-handle" />
      <div className="rf-issue-dot" style={{ background: color }} />
      <div className="rf-issue-text">{data.label as string}</div>
      <div className="rf-issue-meta">
        <span className="rf-issue-priority" style={{ background: color + "20", color }}>
          {data.priority as string}
        </span>
        {(data.childCount as number) > 0 && (
          <span className="rf-issue-children">{data.childCount as number} sub</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="rf-handle" />
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
    <div className="issues-graph">
      <div className="graph-toolbar">
        <div className="graph-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: PRIORITY_COLORS.high }} />
            <span>High</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: PRIORITY_COLORS.medium }} />
            <span>Medium</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: PRIORITY_COLORS.low }} />
            <span>Low</span>
          </div>
        </div>
      </div>

      <div className="graph-canvas" style={{ height: 500 }}>
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
        <div className="graph-detail-card">
          <div className="graph-detail-header">
            <span
              className="graph-detail-priority"
              style={{
                background: PRIORITY_COLORS[selectedIssue.priority] + "20",
                color: PRIORITY_COLORS[selectedIssue.priority],
              }}
            >
              {selectedIssue.priority}
            </span>
            <span className="graph-detail-depth">Level {selectedIssue.depth + 1}</span>
          </div>
          <p className="graph-detail-text">{selectedIssue.text}</p>
          {selectedIssue.childCount > 0 && (
            <p className="graph-detail-children">
              {selectedIssue.childCount} sub-issue{selectedIssue.childCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
