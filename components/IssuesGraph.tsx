import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  Platform,
} from "react-native";
import Svg, { Line, Circle, G, ForeignObject } from "react-native-svg";
import Colors from "@/constants/colors";

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
  high: Colors.error,
  medium: Colors.warning,
  low: Colors.textMuted,
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
    nodeMap.set(n.id, {
      ...n,
      x: 0,
      y: 0,
      depth: 0,
      children: [],
    });
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

  let minX = Infinity;
  let maxX = -Infinity;
  nodeMap.forEach((n) => {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
  });

  const padding = 80;
  const offsetX = -minX + padding;
  nodeMap.forEach((n) => {
    n.x += offsetX;
  });

  const width = maxX - minX + padding * 2;
  const height = (maxDepth + 1) * LEVEL_HEIGHT + 100;

  return { layoutNodes: nodeMap, edges, width, height };
}

export default function IssuesGraph({ issues }: { issues: IssueNode[] }) {
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const lastPan = useRef({ x: 0, y: 0 });

  const { layoutNodes, edges, width, height } = useMemo(
    () => layoutTree(issues),
    [issues]
  );

  const screenWidth = Dimensions.get("window").width - 40;

  const initialScale = useMemo(() => {
    const s = Math.min(screenWidth / width, 1);
    return Math.max(s, 0.25);
  }, [screenWidth, width]);

  const effectiveScale = useMemo(() => scale * initialScale, [scale, initialScale]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
        onPanResponderGrant: () => {
          lastPan.current = { x: panOffset.x, y: panOffset.y };
        },
        onPanResponderMove: (_, gs) => {
          setPanOffset({
            x: lastPan.current.x + gs.dx,
            y: lastPan.current.y + gs.dy,
          });
        },
      }),
    [panOffset]
  );

  const nodesArray = useMemo(() => Array.from(layoutNodes.values()), [layoutNodes]);

  const svgWidth = Math.max(width * effectiveScale + 60, screenWidth);
  const svgHeight = height * effectiveScale + 40;

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Text
          style={styles.zoomBtn}
          onPress={() => setScale((s) => Math.min(s + 0.15, 2.5))}
        >
          +
        </Text>
        <Text
          style={styles.zoomBtn}
          onPress={() => setScale((s) => Math.max(s - 0.15, 0.3))}
        >
          -
        </Text>
        <Text
          style={styles.zoomBtn}
          onPress={() => {
            setScale(1);
            setPanOffset({ x: 0, y: 0 });
          }}
        >
          Reset
        </Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PRIORITY_COLORS.high }]} />
          <Text style={styles.legendText}>High</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PRIORITY_COLORS.medium }]} />
          <Text style={styles.legendText}>Medium</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PRIORITY_COLORS.low }]} />
          <Text style={styles.legendText}>Low</Text>
        </View>
      </View>

      <View
        style={styles.graphContainer}
        {...panResponder.panHandlers}
      >
        <Svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`${-panOffset.x / effectiveScale} ${-panOffset.y / effectiveScale} ${svgWidth / effectiveScale} ${svgHeight / effectiveScale}`}
        >
          {edges.map((edge, i) => (
            <Line
              key={`edge-${i}`}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke={Colors.surfaceBorder}
              strokeWidth={2 / effectiveScale}
              strokeOpacity={0.7}
            />
          ))}

          {nodesArray.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const color = PRIORITY_COLORS[node.priority] || Colors.textMuted;
            const r = NODE_RADIUS;

            return (
              <G
                key={`node-${node.id}`}
                onPress={() =>
                  setSelectedNode(isSelected ? null : node)
                }
              >
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 4}
                  fill={isSelected ? color : "transparent"}
                  opacity={0.15}
                />
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={Colors.surface}
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={6}
                  fill={color}
                />
                {Platform.OS === "web" ? (
                  <ForeignObject
                    x={node.x - 70}
                    y={node.y + r + 4}
                    width={140}
                    height={44}
                  >
                    <View style={styles.labelContainer}>
                      <Text
                        style={[
                          styles.nodeLabel,
                          isSelected && { fontFamily: "Inter_600SemiBold", color: Colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {node.text}
                      </Text>
                    </View>
                  </ForeignObject>
                ) : null}
              </G>
            );
          })}
        </Svg>
      </View>

      {Platform.OS !== "web" && (
        <View style={styles.mobileLabels}>
          {nodesArray.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const color = PRIORITY_COLORS[node.priority] || Colors.textMuted;
            const labelX = node.x * effectiveScale + panOffset.x - 70;
            const labelY =
              (node.y + NODE_RADIUS + 4) * effectiveScale + panOffset.y;
            return (
              <View
                key={`label-${node.id}`}
                style={[
                  styles.mobileLabelWrap,
                  {
                    left: labelX,
                    top: labelY,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.nodeLabel,
                    isSelected && { fontFamily: "Inter_600SemiBold", color },
                  ]}
                  numberOfLines={2}
                >
                  {node.text}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {selectedNode && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View
              style={[
                styles.detailPriority,
                {
                  backgroundColor:
                    PRIORITY_COLORS[selectedNode.priority] + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.detailPriorityText,
                  { color: PRIORITY_COLORS[selectedNode.priority] },
                ]}
              >
                {selectedNode.priority}
              </Text>
            </View>
            <Text style={styles.detailDepth}>Level {selectedNode.depth + 1}</Text>
          </View>
          <Text style={styles.detailText}>{selectedNode.text}</Text>
          {selectedNode.children.length > 0 && (
            <Text style={styles.detailChildren}>
              {selectedNode.children.length} sub-issue
              {selectedNode.children.length > 1 ? "s" : ""}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  controls: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  zoomBtn: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
    textAlign: "center",
  },
  legend: {
    flexDirection: "row",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  graphContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
    minHeight: 300,
  },
  labelContainer: {
    alignItems: "center",
  },
  nodeLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 14,
  },
  mobileLabels: {
    position: "absolute",
  },
  mobileLabelWrap: {
    position: "absolute",
    width: 140,
    alignItems: "center",
  },
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  detailPriority: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailPriorityText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  detailDepth: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  detailText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 22,
  },
  detailChildren: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
