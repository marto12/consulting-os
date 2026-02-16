import { useMemo, useState, useRef, useCallback } from "react";
import "./IssuesGraph.css";

interface IssueNode {
  id: number;
  parentId: number | null;
  text: string;
  priority: string;
}

interface LayoutNode {
  id: number;
  parentId: number | null;
  text: string;
  priority: string;
  x: number;
  y: number;
  depth: number;
  children: number[];
}

interface Edge {
  from: LayoutNode;
  to: LayoutNode;
}

const NODE_RADIUS = 28;
const LEVEL_HEIGHT = 120;
const BASE_NODE_SPACING = 160;
const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#94A3B8",
};

function layoutTree(nodes: IssueNode[]): {
  layoutNodes: Map<number, LayoutNode>;
  edges: Edge[];
  width: number;
  height: number;
} {
  const nodeMap = new Map<number, LayoutNode>();
  const childrenMap = new Map<number, number[]>();

  nodes.forEach((n) => {
    nodeMap.set(n.id, { ...n, x: 0, y: 0, depth: 0, children: [] });
    childrenMap.set(n.id, []);
  });

  const roots: number[] = [];
  nodes.forEach((n) => {
    if (n.parentId && childrenMap.has(n.parentId)) {
      childrenMap.get(n.parentId)!.push(n.id);
    } else if (!n.parentId) {
      roots.push(n.id);
    }
  });

  nodeMap.forEach((node) => {
    node.children = childrenMap.get(node.id) || [];
  });

  function setDepth(id: number, depth: number) {
    const node = nodeMap.get(id)!;
    node.depth = depth;
    node.children.forEach((cid) => setDepth(cid, depth + 1));
  }
  roots.forEach((rid) => setDepth(rid, 0));

  let maxDepth = 0;
  nodeMap.forEach((n) => {
    if (n.depth > maxDepth) maxDepth = n.depth;
  });

  let leafIndex = 0;
  function assignX(id: number): number {
    const node = nodeMap.get(id)!;
    if (node.children.length === 0) {
      node.x = leafIndex * BASE_NODE_SPACING;
      leafIndex++;
      return node.x;
    }
    const childXs = node.children.map((cid) => assignX(cid));
    node.x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    return node.x;
  }
  roots.forEach((rid) => assignX(rid));

  nodeMap.forEach((node) => {
    node.y = node.depth * LEVEL_HEIGHT + 60;
  });

  const edges: Edge[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      edges.push({ from: nodeMap.get(node.parentId)!, to: node });
    }
  });

  let minX = Infinity, maxX = -Infinity;
  nodeMap.forEach((n) => {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
  });

  const padding = 80;
  const offsetX = -minX + padding;
  nodeMap.forEach((n) => { n.x += offsetX; });

  const width = maxX - minX + padding * 2;
  const height = (maxDepth + 1) * LEVEL_HEIGHT + 100;

  return { layoutNodes: nodeMap, edges, width, height };
}

export default function IssuesGraph({ issues }: { issues: IssueNode[] }) {
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const { layoutNodes, edges, width, height } = useMemo(() => layoutTree(issues), [issues]);
  const nodesArray = useMemo(() => Array.from(layoutNodes.values()), [layoutNodes]);

  const containerWidth = 800;
  const initialScale = useMemo(() => {
    const s = Math.min(containerWidth / width, 1);
    return Math.max(s, 0.25);
  }, [containerWidth, width]);

  const effectiveScale = scale * initialScale;
  const svgWidth = Math.max(width * effectiveScale + 60, containerWidth);
  const svgHeight = height * effectiveScale + 40;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPanOffset(prev => ({
      x: prev.x + (e.clientX - lastMouse.current.x),
      y: prev.y + (e.clientY - lastMouse.current.y),
    }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(s => Math.max(0.3, Math.min(2.5, s + delta)));
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
        <div className="graph-zoom-controls">
          <button className="zoom-btn" onClick={() => setScale(s => Math.min(s + 0.15, 2.5))}>+</button>
          <button className="zoom-btn" onClick={() => setScale(s => Math.max(s - 0.15, 0.3))}>-</button>
          <button className="zoom-btn" onClick={() => { setScale(1); setPanOffset({ x: 0, y: 0 }); }}>Reset</button>
        </div>
      </div>

      <div
        className="graph-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging.current ? "grabbing" : "grab" }}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`${-panOffset.x / effectiveScale} ${-panOffset.y / effectiveScale} ${svgWidth / effectiveScale} ${svgHeight / effectiveScale}`}
        >
          {edges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke="#E2E8F0"
              strokeWidth={2 / effectiveScale}
              strokeOpacity={0.7}
            />
          ))}
          {nodesArray.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const color = PRIORITY_COLORS[node.priority] || "#94A3B8";
            const r = NODE_RADIUS;
            return (
              <g
                key={`node-${node.id}`}
                onClick={() => setSelectedNode(isSelected ? null : node)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={node.x} cy={node.y} r={r + 4} fill={isSelected ? color : "transparent"} opacity={0.15} />
                <circle cx={node.x} cy={node.y} r={r} fill="#fff" stroke={color} strokeWidth={isSelected ? 3 : 2} />
                <circle cx={node.x} cy={node.y} r={6} fill={color} />
                <foreignObject x={node.x - 70} y={node.y + r + 4} width={140} height={44}>
                  <div style={{ textAlign: "center" }}>
                    <span style={{
                      fontSize: 11,
                      color: isSelected ? "#0F172A" : "#64748B",
                      fontWeight: isSelected ? 600 : 400,
                      lineHeight: "14px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as any,
                      overflow: "hidden",
                    }}>
                      {node.text}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedNode && (
        <div className="graph-detail-card">
          <div className="graph-detail-header">
            <span
              className="graph-detail-priority"
              style={{
                background: PRIORITY_COLORS[selectedNode.priority] + "20",
                color: PRIORITY_COLORS[selectedNode.priority],
              }}
            >
              {selectedNode.priority}
            </span>
            <span className="graph-detail-depth">Level {selectedNode.depth + 1}</span>
          </div>
          <p className="graph-detail-text">{selectedNode.text}</p>
          {selectedNode.children.length > 0 && (
            <p className="graph-detail-children">
              {selectedNode.children.length} sub-issue{selectedNode.children.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
